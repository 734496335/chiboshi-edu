/**
 * /api/dict/ask
 *
 * 量感字典"问一问"：孩子输入任意物品（"霸王龙"、"我家电饭锅"、"喜马拉雅山"），
 * AI 返回：
 *   - 一段儿童友好的尺寸描述（2-3 句，强调"和身体经验/熟悉物品的比较"）
 *   - 数值化尺寸 sizeM + 友好文案 sizeText
 *   - 视觉提示（best matching catalog 物品名）—— 由服务端再 fuzzy 映射到真实 catalog id
 *
 * 入参：{ q: string, dim?: DimensionKey }  默认 dim=length
 * 出参：{
 *   ok: true,
 *   label: string,              // 标准名（AI 规整后）
 *   description: string,        // 描述文案
 *   sizeText: string,
 *   sizeM: number,
 *   catalogId: string | null,   // 服务端解析的真实 catalog id（含已烤 PNG）
 *   visualHint: string,         // AI 建议的视觉名（调试/降级用）
 * } | { ok: false, error: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { chatJSON, DeepSeekError } from "@/lib/deepseek";
import { findCatalogEntryByName } from "@/lib/catalog";
import type { DimensionKey } from "@/lib/dimensions";

export const runtime = "nodejs";

interface AskAIResponse {
  /** 物品规范名，去掉"我家的""一个"等修饰，控制在 6 字内 */
  label: string;
  /** 儿童语气的描述 —— 2~3 句，必须含一个具体的尺寸 + 一个身体/熟悉物对比 */
  description: string;
  /** 数值（米/千克/秒/平方米/立方米/升，按维度） */
  size_value: number;
  /** 友好文案，如 "约 12 米长" */
  size_text: string;
  /** 用于在 catalog 里找 PNG 的中文名，最贴近的常见物品名 */
  visual_hint: string;
}

const UNIT_BY_DIM: Record<DimensionKey, string> = {
  length: "米",
  weight: "千克",
  area: "平方米",
  volume: "升",
  cubic: "立方米",
  time: "秒",
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    q?: string;
    dim?: DimensionKey;
  };
  const q = (body.q ?? "").trim();
  const dim: DimensionKey = body.dim ?? "length";
  if (!q) {
    return NextResponse.json(
      { ok: false, error: "请告诉我你想问的物品名" },
      { status: 400 },
    );
  }

  const unit = UNIT_BY_DIM[dim] ?? "米";

  // —— Prompt ——
  // 强约束：JSON only；description 限制句数；size 必须数值；视觉名优先用日常常见词
  const system = `你是一位小学量感教育助手"尺博士"，专门帮 6-12 岁孩子建立对真实世界尺寸的直觉。
你要把任何物体的尺寸用孩子能理解的方式描述出来——必须含：
  1) 一个具体数字（带单位${unit}）
  2) 一个孩子身体经验或熟悉物品的对比（如 "比 3 个你还要高"、"相当于 5 个铅笔盒"）
语气活泼但精确，不要"大约可能" 这种含糊词。`;

  const userMsg = `物品："${q}"
当前关注维度：${dim === "length" ? "长度（米）" : dim === "weight" ? "重量（千克）" : dim === "area" ? "面积（平方米）" : dim === "volume" ? "容积（升）" : dim === "cubic" ? "体积（立方米）" : "时间（秒）"}

请用 JSON 回答（不要任何额外文字、markdown、注释）：
{
  "label": "物品的规范短名，不超过 6 个汉字",
  "description": "2-3 句儿童语气的描述，必须含数字+单位 与 身体经验对比",
  "size_value": <数字，单位=${unit}>,
  "size_text": "友好尺寸文案，如 '约 12 米长' / '约 3.5 吨重' / '相当于 1 个游泳池'",
  "visual_hint": "一个能在图标库找到的常见中文物品名，越短越好（如 '蓝鲸'、'高楼'、'恐龙'）"
}

如果用户问的是模糊概念（"很大很大的东西"），用 label="未知" + description="抱歉，再具体一点儿告诉我吧～" + size_value=0 + size_text="" + visual_hint=""。`;

  try {
    const parsed = await chatJSON<AskAIResponse>(
      [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      { temperature: 0.6, timeoutMs: 25000 },
    );

    if (!parsed.label || parsed.label === "未知" || !parsed.size_value) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.description || "我不太懂这个物品，再具体一点儿吧～",
        },
        { status: 200 },
      );
    }

    // —— 视觉映射：AI 给的 hint → catalog id ——
    // 1. 先用 visual_hint 精确匹配
    // 2. 退回到用户原 query
    // 3. 退回到 AI 规范化 label
    const candidates = [parsed.visual_hint, q, parsed.label].filter(Boolean);
    let catalogId: string | null = null;
    for (const cand of candidates) {
      const hit = await findCatalogEntryByName(cand);
      if (hit) {
        catalogId = hit.id;
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      label: parsed.label,
      description: parsed.description,
      sizeText: parsed.size_text,
      sizeM: parsed.size_value,
      catalogId,
      visualHint: parsed.visual_hint,
    });
  } catch (err) {
    const msg =
      err instanceof DeepSeekError
        ? err.message
        : err instanceof Error
          ? err.message
          : "AI 服务忙，待会儿再试试～";
    console.warn("[/api/dict/ask] 失败：", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
