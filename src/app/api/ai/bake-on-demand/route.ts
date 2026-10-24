/**
 * POST /api/ai/bake-on-demand
 * Body: {
 *   id: string,           // kebab/snake, [a-z0-9_-]
 *   label: string,        // 中文显示名
 *   aliases?: string[],
 *   axis?: "horizontal" | "vertical" | "either" | "square",
 *   category?: string,    // 自由文本（vehicle / animal / building ...）
 *   prompt: string        // SDXL prompt 主体
 * }
 *
 * 当沙盒 AI 在 catalog 里找不到合适匹配时调用：
 *   1. 把新条目原子追加到 scripts/pixel-bake/visual-assets.json（去重）
 *   2. 触发 bake.py --only <id> --force（串行）
 *   3. 返回最终 PNG URL
 *
 * 调用方应在 wait=false 模式下 fire-and-forget；wait=true 时同步等到 PNG 就绪。
 */
import { NextRequest, NextResponse } from "next/server";
import { runBakeForId } from "@/lib/bake";
import {
  appendCatalogEntry,
  invalidateCatalogCache,
  type CatalogEntry,
} from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

interface BakeOnDemandBody {
  id?: string;
  label?: string;
  aliases?: string[];
  axis?: CatalogEntry["axis"];
  category?: string;
  prompt?: string;
  /** 是否阻塞等待烤完；默认 false（fire-and-forget） */
  wait?: boolean;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as BakeOnDemandBody;
  const id = (body.id ?? "").trim();
  const label = (body.label ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.filter((s) => typeof s === "string").map((s) => s.trim())
    : [];
  const axis: CatalogEntry["axis"] = (
    body.axis === "vertical" ||
    body.axis === "horizontal" ||
    body.axis === "either" ||
    body.axis === "square"
      ? body.axis
      : "horizontal"
  ) as CatalogEntry["axis"];
  const category = (body.category ?? "world").trim() || "world";
  const wait = body.wait === true;

  if (!id || !ID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "invalid id (must match [a-z0-9][a-z0-9_-]{0,63})" },
      { status: 400 },
    );
  }
  if (!label) {
    return NextResponse.json(
      { ok: false, error: "label required" },
      { status: 400 },
    );
  }
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "prompt required" },
      { status: 400 },
    );
  }

  const entry: CatalogEntry = {
    id,
    label,
    aliases: aliases.length > 0 ? aliases : undefined,
    category,
    axis,
    prompt,
  };

  try {
    const append = await appendCatalogEntry(entry);

    if (!wait) {
      // fire-and-forget：不阻塞响应；让客户端轮询 /icons/pixel/<id>.png
      void runBakeForId(id)
        .then((res) => {
          if (res.code !== 0 || !res.pngExists) {
            console.warn(
              `[bake-on-demand] ${id} 失败 code=${res.code}, exists=${res.pngExists}`,
            );
          } else {
            invalidateCatalogCache();
          }
        })
        .catch((err) =>
          console.warn(`[bake-on-demand] ${id} 异常：`, err),
        );
      return NextResponse.json({
        ok: true,
        id,
        appended: append.added,
        url: `/icons/pixel/${id}.png`,
        baking: true,
      });
    }

    const result = await runBakeForId(id);
    if (result.code !== 0 || !result.pngExists) {
      return NextResponse.json(
        {
          ok: false,
          error: `bake.py exit ${result.code}, png exists=${result.pngExists}`,
          log: result.log.slice(-2000),
          appended: append.added,
        },
        { status: 500 },
      );
    }
    invalidateCatalogCache();
    return NextResponse.json({
      ok: true,
      id,
      appended: append.added,
      url: `/icons/pixel/${id}.png?t=${Date.now()}`,
      elapsedMs: result.elapsedMs,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
