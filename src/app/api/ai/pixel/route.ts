/**
 * AI 像素画生成端点
 *
 * 让 MiMo 直接输出 16×16 像素画 SVG（一堆 <rect>），存到 public/icons/pixel/{slug}.svg。
 *
 * 输入  POST { object: "椰子树" }  或  GET  ?q=椰子树
 * 输出  200 { id: "pixel:{slug}", url: "/icons/pixel/{slug}.svg", cached, attempts, raw? }
 *      503 生成 / 验证失败
 *
 * 与 /api/ai/sketch 的区别：
 *   - sketch    输出 200×200 stroke 简笔画，用于细节较多的物体
 *   - pixel     输出 16×16 RGBA pixel art，统一艺术风格
 */
import type { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chat, DeepSeekError } from "@/lib/deepseek";
import { slugify } from "@/lib/generatedIconCache";

export const runtime = "nodejs";

const PIXEL_DIR = path.join(process.cwd(), "public", "icons", "pixel");

const SYS_PROMPT = `你是 8 位像素画大师，专门为儿童教育画像素风物体图标。输出严格的 SVG 代码，遵守以下硬约束：

【画布尺寸】
0. 你自己决定画布的 W（宽）和 H（高），都是 12-32 之间的整数。
   - 高瘦物体（椰子树、旗杆、灯塔、长颈鹿）：H 比 W 大，例如 16×24、12×28
   - 扁宽物体（小汽车、校车、蓝鲸、大桥、铅笔）：W 比 H 大，例如 28×14、24×12
   - 接近方形的物体（苹果、蚂蚁、骰子、网球）：用 16×16 或 20×20
   - 选最贴近物体真实长宽比的尺寸；不要塞满，主体占 70-85% 即可

【输出格式】
1. 只输出完整 <svg>...</svg>，无说明文字、无 markdown。
2. 顶层写法（W、H 替换成你选的值）：
<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H" shape-rendering="crispEdges">
3. 内部只能用 <rect>，每个 rect 必须有 x、y、width、height、fill 四个属性。
   - x、y 是整数，0 ≤ x < W, 0 ≤ y < H
   - width、height 是正整数，x+width ≤ W, y+height ≤ H
   - fill 用 #RRGGBB 十六进制色

【画风】
4. 物体在画布中居中，留 1-3 像素边距。
5. 调色板 6-12 种颜色，明亮饱和（适合儿童），同色块用一个大 rect 覆盖。
6. 线条/轮廓用比主色深一档的颜色（不要纯黑），形状要清晰。
7. 透明背景：不要画整张背景 rect，留空即可。
8. 视角：体现物体最易识别特征的一面（车/动物侧视；建筑正视；植物正视；食物倾斜俯视）。

【效率】
9. **合并相邻同色像素** 为一个 rect。例如 4 个连续蓝色像素用 width="4"，不要拆成 4 个 width="1"。
10. rect 总数 15-60 个之间。

【禁忌】
11. 不要 <path>、<circle>、<line>、<text>、<image>、<style>、<g>、<defs>，只能 <rect>。
12. 不要 stroke、opacity、transform、内联 style、渐变、滤镜。

【参考示范——一棵高瘦的椰子树（16×24，竖向）】
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 16 24" shape-rendering="crispEdges">
  <rect x="2" y="2" width="5" height="1" fill="#2D8A3E"/>
  <rect x="9" y="2" width="5" height="1" fill="#2D8A3E"/>
  <rect x="1" y="3" width="6" height="2" fill="#3FAB52"/>
  <rect x="9" y="3" width="6" height="2" fill="#3FAB52"/>
  <rect x="4" y="5" width="8" height="1" fill="#5DC468"/>
  <rect x="7" y="5" width="2" height="2" fill="#7A4A20"/>
  <rect x="7" y="7" width="2" height="15" fill="#8B5A2B"/>
  <rect x="6" y="22" width="4" height="1" fill="#6B4220"/>
  <rect x="7" y="9" width="2" height="1" fill="#5C3A1C"/>
  <rect x="7" y="14" width="2" height="1" fill="#5C3A1C"/>
  <rect x="7" y="19" width="2" height="1" fill="#5C3A1C"/>
</svg>

【参考示范——一辆扁宽的小汽车（24×14）】
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="14" viewBox="0 0 24 14" shape-rendering="crispEdges">
  <rect x="5" y="3" width="14" height="1" fill="#C92424"/>
  <rect x="4" y="4" width="16" height="4" fill="#E83B3B"/>
  <rect x="6" y="4" width="4" height="3" fill="#A8D8FF"/>
  <rect x="14" y="4" width="4" height="3" fill="#A8D8FF"/>
  <rect x="2" y="8" width="20" height="2" fill="#A02020"/>
  <rect x="4" y="10" width="3" height="3" fill="#1F1F1F"/>
  <rect x="17" y="10" width="3" height="3" fill="#1F1F1F"/>
  <rect x="5" y="11" width="1" height="1" fill="#888888"/>
  <rect x="18" y="11" width="1" height="1" fill="#888888"/>
</svg>`;

const MAX_ATTEMPTS = 3;

interface GenResult {
  svg: string;
  attempts: number;
  raw: string[];
  reason?: string;
}

/** 像素画 SVG 的最小校验，只挡住硬错误，不限制美学。允许 12-32 区间的任意 W×H。 */
function validatePixelSvg(svg: string): { ok: boolean; reason?: string } {
  const trimmed = svg.trim();
  if (!/^<svg[\s\S]*<\/svg>$/i.test(trimmed))
    return { ok: false, reason: "不是完整 <svg> 标签" };

  // 提取 viewBox = "0 0 W H"
  const vbMatch = trimmed.match(/viewBox\s*=\s*"\s*0\s+0\s+(\d+)\s+(\d+)\s*"/i);
  if (!vbMatch)
    return { ok: false, reason: "viewBox 必须是 \"0 0 W H\" 形式（W、H 整数）" };
  const W = Number(vbMatch[1]);
  const H = Number(vbMatch[2]);
  if (W < 12 || W > 32 || H < 12 || H > 32)
    return { ok: false, reason: `画布 ${W}×${H} 越界，W、H 都要 12-32` };

  if (/<path|<circle|<line|<polygon|<text|<image|<g[\s>]|<defs|<style/i.test(trimmed))
    return { ok: false, reason: "只能用 <rect>，不能有其他元素" };
  const rectCount = (trimmed.match(/<rect\b/gi) || []).length;
  if (rectCount < 5) return { ok: false, reason: `rect 太少（${rectCount}），至少 5 个` };
  if (rectCount > 100) return { ok: false, reason: `rect 太多（${rectCount}），最多 100 个` };
  if (!/fill\s*=\s*"#[0-9A-Fa-f]{6}"/i.test(trimmed))
    return { ok: false, reason: "至少一个 fill=\"#RRGGBB\"" };

  const rectMatches = trimmed.matchAll(/<rect[^>]+>/gi);
  for (const m of rectMatches) {
    const tag = m[0];
    const get = (attr: string) => {
      const r = tag.match(new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, "i"));
      return r ? Number(r[1]) : NaN;
    };
    const x = get("x"), y = get("y"), w = get("width"), h = get("height");
    if ([x, y, w, h].some((n) => !Number.isFinite(n) || n < 0))
      return { ok: false, reason: `rect 属性缺失或非法：${tag.slice(0, 80)}` };
    if (x + w > W || y + h > H)
      return { ok: false, reason: `rect 越界 ${W}×${H}：${tag.slice(0, 80)}` };
  }
  return { ok: true };
}

async function generatePixel(object: string): Promise<GenResult> {
  let feedback = "";
  const raw: string[] = [];
  let lastReason: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const userPrompt = feedback
      ? `请画一个"${object}"的像素画。先想清楚它真实长宽比适合哪种画布（高瘦 / 扁宽 / 方形），再画。\n\n${feedback}`
      : `请画一个"${object}"的像素画。先想清楚它真实长宽比适合哪种画布（高瘦 / 扁宽 / 方形），再画。`;

    const text = await chat(
      [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: attempt === 1 ? 0.5 : 0.7, timeoutMs: 300_000 },
    );
    raw.push(text);

    const match = text.match(/<svg[\s\S]*?<\/svg>/i);
    if (!match) {
      feedback = "你没输出 <svg>...</svg>。请只输出 SVG 代码，从 <svg 开头到 </svg> 结尾。";
      lastReason = "未提取到 <svg> 标签";
      continue;
    }
    const svg = match[0];
    const qa = validatePixelSvg(svg);
    if (qa.ok) return { svg, attempts: attempt, raw };
    feedback = `上次输出有问题：${qa.reason}。请严格按系统提示词的规则重画一次。`;
    lastReason = qa.reason;
  }
  return { svg: "", attempts: MAX_ATTEMPTS, raw, reason: lastReason };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { object?: string; force?: boolean };
    const object = (body.object || "").trim();
    if (!object)
      return Response.json({ error: "缺少 object 字段" }, { status: 400 });

    const slug = slugify(object);
    const filePath = path.join(PIXEL_DIR, `${slug}.svg`);
    const url = `/icons/pixel/${slug}.svg`;

    // 缓存命中
    if (!body.force) {
      try {
        await fs.access(filePath);
        return Response.json({
          id: `pixel:${slug}`,
          url,
          slug,
          cached: true,
          attempts: 0,
        });
      } catch {
        /* miss → 继续生成 */
      }
    }

    const result = await generatePixel(object);
    if (!result.svg) {
      return Response.json(
        {
          error: "生成失败：MiMo 三次都不达标",
          reason: result.reason,
          attempts: result.attempts,
          raw: result.raw,
        },
        { status: 503 },
      );
    }

    await fs.mkdir(PIXEL_DIR, { recursive: true });
    await fs.writeFile(filePath, result.svg, "utf8");

    return Response.json({
      id: `pixel:${slug}`,
      url,
      slug,
      svg: result.svg,
      cached: false,
      attempts: result.attempts,
    });
  } catch (err) {
    const msg =
      err instanceof DeepSeekError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!q) return Response.json({ error: "缺少 q 参数" }, { status: 400 });
  return POST(
    new Request(req.url, {
      method: "POST",
      body: JSON.stringify({ object: q, force }),
    }) as unknown as NextRequest,
  );
}
