/**
 * AI 简笔画生成（带 QA 流水线 + 缓存）
 *
 * 当 iconRegistry.pickIcon() 找不到合适的库内图标时，由 parse 路由调用本端点。
 * 流程：
 *   1. 查缓存 → 命中即返回
 *   2. 调 MiMo 输出 SVG（严格 prompt + 示例）
 *   3. 跑 svgQa.validateSvg() → 不通过则附上修订指令重试（最多 2 次）
 *   4. 通过 → 落盘缓存 → 返回 URL + Iconify 风格的 ID（"generated:{slug}"）
 *
 * 输入 / 输出：
 *   POST  body: { object: "霸王龙" }
 *   200   { id: "generated:abc123", url: "/icons/generated/abc123.svg",
 *           cached: false, attempts: 2, issues: [...] }
 *   503   { error, raw, issues }   // 三次都没过
 */
import type { NextRequest } from "next/server";
import { chat, DeepSeekError } from "@/lib/deepseek";
import {
  publicUrlFor,
  readCache,
  slugify,
  writeCache,
} from "@/lib/generatedIconCache";
import { issuesToFeedback, validateSvg, type SvgIssue } from "@/lib/svgQa";

export const runtime = "nodejs";

const SYS_PROMPT = `你是一位儿童绘本插画师，擅长用最简洁的线条画"白板可读简笔画"。输出 SVG 代码，遵循以下硬约束（不可商量）：

【输出格式】
1. 只输出完整的 <svg>...</svg>，不要任何说明文字、不要 markdown 代码块。
2. 顶层固定写法：<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" fill="none" stroke="#4A3520" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">

【画风】
3. 主体居中，占画布约 70%。
4. 一笔一笔分开画——每条 path/line/rect/circle 表达一个语义元素，**严禁把多段图形塞进同一个 d 串**。
5. 图元总数 5–15 条之间。少于 5 条画不出形，多于 15 条会糊。
6. 单个 d 字符串不超过 200 字符。

【禁忌】
7. 严禁 fill 实心填充（除非显式 fill="none"），严禁渐变 / 阴影 / 滤镜。
8. 严禁 <text>、<image>、<style>、<symbol>、<use>、<foreignObject>。
9. 严禁内联 style 属性。
10. 视角：能体现物体最易识别特征的一面（车/动物用侧视；建筑用正视；植物用正视）。

【参考示范——一座桥】
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" fill="none" stroke="#4A3520" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 130 Q100 60 180 130"/>
  <line x1="20" y1="130" x2="20" y2="170"/>
  <line x1="180" y1="130" x2="180" y2="170"/>
  <line x1="20" y1="170" x2="180" y2="170"/>
  <line x1="60" y1="130" x2="60" y2="170"/>
  <line x1="100" y1="105" x2="100" y2="170"/>
  <line x1="140" y1="130" x2="140" y2="170"/>
</svg>`;

const MAX_ATTEMPTS = 3;

interface GenerateResult {
  svg: string;
  attempts: number;
  finalIssues: SvgIssue[];
  rawHistory: string[];
}

async function generateWithQA(object: string): Promise<GenerateResult | null> {
  let feedback = "";
  const rawHistory: string[] = [];
  let lastIssues: SvgIssue[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const userPrompt = feedback
      ? `请画一个"${object}"的简笔画。\n\n${feedback}`
      : `请画一个"${object}"的简笔画。`;

    const raw = await chat(
      [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: attempt === 1 ? 0.4 : 0.6, timeoutMs: 30_000 },
    );
    rawHistory.push(raw);

    const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
    if (!match) {
      feedback =
        "上一次没输出 <svg>...</svg> 标签内容。请直接以 <svg 开头到 </svg> 结尾，不要任何前后文字。";
      lastIssues = [
        { code: "no-svg", message: "未提取到 <svg> 标签", severity: "error" },
      ];
      continue;
    }
    const svg = match[0];
    const qa = validateSvg(svg);
    lastIssues = qa.issues;

    if (qa.pass) {
      return { svg, attempts: attempt, finalIssues: qa.issues, rawHistory };
    }
    feedback = issuesToFeedback(qa.issues);
  }
  return { svg: "", attempts: MAX_ATTEMPTS, finalIssues: lastIssues, rawHistory };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { object?: string };
    const object = (body.object || "").trim();
    if (!object) {
      return Response.json({ error: "缺少 object 字段" }, { status: 400 });
    }

    const slug = slugify(object);

    // 1) 缓存命中
    const cached = await readCache(slug);
    if (cached) {
      return Response.json({
        id: `generated:${slug}`,
        url: publicUrlFor(slug),
        slug,
        cached: true,
        attempts: 0,
        issues: [],
      });
    }

    // 2) 生成 + QA + 重试
    const result = await generateWithQA(object);
    if (!result || !result.svg) {
      return Response.json(
        {
          error: "生成失败：QA 三次都没过",
          attempts: MAX_ATTEMPTS,
          issues: result?.finalIssues ?? [],
          rawHistory: result?.rawHistory ?? [],
        },
        { status: 503 },
      );
    }

    // 3) 写盘缓存
    await writeCache(slug, result.svg);

    return Response.json({
      id: `generated:${slug}`,
      url: publicUrlFor(slug),
      slug,
      svg: result.svg,
      cached: false,
      attempts: result.attempts,
      issues: result.finalIssues,
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

/** GET 直接传 ?q= 也能用，便于测试 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return Response.json({ error: "缺少 q 参数" }, { status: 400 });
  return POST(
    new Request(req.url, {
      method: "POST",
      body: JSON.stringify({ object: q }),
    }) as unknown as NextRequest,
  );
}
