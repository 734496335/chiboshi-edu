/**
 * POST /api/dev/icons/create
 *
 * 在 /dev/icons 页面顶部表单"无限新建物品"用：
 *   - 校验输入（label / category 必填，id 唯一且符合 slug 规则）
 *   - 追加进 visual-assets.json
 *   - 通过常驻 worker 烘焙 PNG（首次预热慢；之后每条 ~10s）
 *
 * Body:
 *   {
 *     id?: string,           // 不给则按 label 生成 slug
 *     label: string,
 *     category: string,
 *     axis?: 'horizontal'|'vertical'|'either'|'square',
 *     aliases?: string[] | string (comma separated),
 *     prompt?: string,       // 英文 SDXL prompt 主体；省略则用 label 兜底
 *   }
 *
 * 同步等待烘焙完成（最长 maxDuration），返回 PNG url。
 */
import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  appendCatalogEntry,
  getCatalogEntry,
  invalidateCatalogCache,
} from "@/lib/catalog";
import { getBakeWorker } from "@/lib/bakeWorker";
import { chat } from "@/lib/deepseek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const ID_RE = /^[a-z0-9_\-]+$/;
const VALID_AXIS = new Set(["horizontal", "vertical", "either", "square"]);

/**
 * 调用 LLM 将中文物品名翻译成 FLUX 能理解的简洁英文 prompt。
 * 只在用户没有手动传 prompt 时使用。
 */
async function translateToPrompt(label: string): Promise<string | undefined> {
  try {
    const result = await chat(
      [
        {
          role: "system",
          content:
            'You are a translator for a children\'s image generation tool. ' +
            'Convert a Chinese object name into a concise English image generation prompt. ' +
            'Rules:\n' +
            '- Output ONLY the English prompt, nothing else\n' +
            '- Keep it short (under 20 words)\n' +
            '- Describe the object visually, not abstractly\n' +
            '- Use simple, concrete English that a diffusion model understands\n' +
            '- No quotes, no punctuation at the end\n' +
            'Examples:\n' +
            '椰子树 → tall coconut palm tree with green leaves and brown trunk\n' +
            '蚂蚁 → side view of an ant with 6 legs\n' +
            '铅笔 → wooden pencil with pink eraser, horizontal\n' +
            '一节课 → classroom clock showing 40 minutes\n' +
            '蓝鲸 → side view of a blue whale, full body',
        },
        { role: "user", content: label },
      ],
      { temperature: 0.3, timeoutMs: 10_000 },
    );
    const trimmed = result.trim().replace(/^["']|["']$/g, "");
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function slugifyLabel(label: string): string {
  // 只保留 ASCII；中文 → 失败时用时间戳兜底
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (ascii && ID_RE.test(ascii)) return ascii.slice(0, 60);
  return `item_${Date.now().toString(36)}`;
}

interface Body {
  id?: string;
  label?: string;
  category?: string;
  axis?: string;
  aliases?: string[] | string;
  prompt?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const label = (body.label ?? "").trim();
  const category = (body.category ?? "").trim();
  if (!label) {
    return NextResponse.json(
      { ok: false, error: "label 必填" },
      { status: 400 },
    );
  }
  if (!category) {
    return NextResponse.json(
      { ok: false, error: "category 必填" },
      { status: 400 },
    );
  }

  let id = (body.id ?? "").trim();
  if (!id) id = slugifyLabel(label);
  if (!ID_RE.test(id)) {
    return NextResponse.json(
      {
        ok: false,
        error: "id 必须只包含 [a-z0-9_-]（中文 label 会自动转 slug，留空即可）",
      },
      { status: 400 },
    );
  }

  const axis = body.axis && VALID_AXIS.has(body.axis) ? body.axis : "either";

  let aliases: string[] | undefined;
  if (Array.isArray(body.aliases)) {
    aliases = body.aliases.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof body.aliases === "string" && body.aliases.trim()) {
    aliases = body.aliases
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (aliases && aliases.length === 0) aliases = undefined;

  // prompt：优先用用户传的，否则调 LLM 把中文 label 翻译成英文 prompt
  let promptText =
    typeof body.prompt === "string" ? body.prompt.trim() : undefined;
  if (!promptText) {
    promptText = await translateToPrompt(label);
  }

  // 已存在则提前拦——给前端友好提示
  const existing = await getCatalogEntry(id);
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: `id "${id}" 已存在 (label="${existing.label}")，换一个 id 或在原条目里改 prompt 后重生`,
        existing,
      },
      { status: 409 },
    );
  }

  const entry = {
    id,
    label,
    category,
    axis: axis as "horizontal" | "vertical" | "either" | "square",
    aliases,
    prompt: promptText && promptText.length > 0 ? promptText : undefined,
  };

  try {
    const { added } = await appendCatalogEntry(entry);
    if (!added) {
      return NextResponse.json(
        { ok: false, error: "追加 catalog 失败（id 冲突）" },
        { status: 409 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `写入 catalog 失败: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }

  // 触发烘焙
  const worker = getBakeWorker();
  try {
    const r = await worker.bake(entry as unknown as Record<string, unknown>);
    const outPng = path.join(
      process.cwd(),
      "public",
      "icons",
      "pixel",
      `${id}.png`,
    );
    const pngExists = existsSync(outPng);
    invalidateCatalogCache();
    if (!r.ok || !pngExists) {
      return NextResponse.json(
        {
          ok: false,
          id,
          error: r.error ?? `worker 报失败; png=${pngExists}`,
          elapsedMs: r.elapsedMs,
          // catalog 已写入，下次仍可在 /dev/icons 看到这个 missing 条目并手动重生
          catalogAppended: true,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      id,
      label,
      category,
      url: `/icons/pixel/${id}.png?t=${Date.now()}`,
      elapsedMs: r.elapsedMs,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        id,
        error: e instanceof Error ? e.message : String(e),
        catalogAppended: true,
      },
      { status: 500 },
    );
  }
}
