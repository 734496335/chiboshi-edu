/**
 * POST /api/ai/parse
 *
 * 场景 1（任意输入互动）核心 API。
 *
 * 输入：
 *   { text: "楼层 200 米" }                    // 自由文本（推荐）
 *   或 { object, value, unit, dimension }       // 结构化（前端已经拆好字段时）
 *
 * 输出：见 ParsedInput 类型。
 *
 * 流程：DeepSeek 解析 → 校验 JSON 形状 → 兜底（API 失败时返回 deterministic fallback）。
 */

import type { NextRequest } from "next/server";
import { chatJSON, DeepSeekError } from "@/lib/deepseek";
import { pickIcon, pickIconWithSketchFallback } from "@/lib/iconRegistry";
import {
  getReferencesForAI,
  REFERENCE_MAP,
  type DimensionKey,
  type ReferenceObject,
} from "@/lib/references";
import { toSI, formatLength } from "@/lib/units";
import {
  resolveVisualForReference,
  resolveVisualForTarget,
  type ResolvedVisual,
} from "@/lib/visualAssets";
import {
  appendCatalogEntry,
  findCatalogEntryByName,
  getAvailableForLengthAxis,
  getCatalogEntry,
  hasPng,
  entryToLlmLine,
  type CatalogEntry,
} from "@/lib/catalog";
import { runBakeForId } from "@/lib/bake";

export const runtime = "nodejs";

/**
 * 不同维度下"小学生可接受的倍数范围"：
 *   - length/weight/time：线性 → 3×
 *   - area：边长 ∝ √面积，9× 面积 = 3× 边长
 *   - cubic/volume：棱长 ∝ ∛体积，64× 体积 = 4× 棱长
 *
 * 这个比例直接决定 AI 选 ref / 校验 ref 的"近邻带宽"。
 * 体积维度放宽是因为 references.ts 在小尺寸（cm³）侧的样本极稀疏，
 * 且立方体视觉上的尺寸感主要来自棱长，不是体积本身。
 */
function ratioBoundsFor(dim: DimensionKey): {
  RATIO_MIN: number;
  RATIO_MAX: number;
} {
  if (dim === "cubic" || dim === "volume") {
    return { RATIO_MIN: 1 / 64, RATIO_MAX: 64 };
  }
  if (dim === "area") return { RATIO_MIN: 1 / 9, RATIO_MAX: 9 };
  return { RATIO_MIN: 1 / 3, RATIO_MAX: 3 };
}

/**
 * 每个维度需要挑的参照物个数。
 *
 * - 长度 / 面积 / 体积 / 容积 / 时间：2 个（小 + 大，给出"夹击式"对比，
 *   小学生从两侧推断量级）。
 * - **重量：1 个**——重量维度的舞台是"天平"隐喻，只对一个参照物比一比就
 *   够了；再多反而让画面变成 3 物乱比，违背天平的语义。
 */
function refCountFor(dim: DimensionKey): number {
  return dim === "weight" ? 1 : 2;
}

/** AI 返回的 JSON 结构（与前端契约） */
export interface ParsedInput {
  /** 教师输入的物体名 */
  object: string;
  /** 物体类别（building / vehicle / body / ...） */
  object_type: string;
  /** 数值 */
  value: number;
  /** 用户原始单位 */
  unit: string;
  /** 维度 */
  dimension: DimensionKey;
  /** 归一化后的 SI 值（length 用 m, weight 用 kg, ...） */
  value_in_si: number;
  /**
   * 比较轴向：
   *   - "horizontal" 长 / 宽 / 厚 / 物体身长（车、桥、铅笔、动物）
   *   - "vertical"   高 / 身高 / 楼高 / 树高 / 山高
   *   - 决定前端 VisualCompare 用"竖向堆叠"还是"横向并排"渲染。
   */
  target_axis: "horizontal" | "vertical";
  /** 荒谬程度 */
  absurdity: "none" | "low" | "medium" | "high" | "extreme";
  /** 从 ALL_REFERENCES 里挑出的参考物 ID 列表，3-5 个 */
  comparison_refs: string[];
  /** AI 为用户输入物挑的 Iconify Fluent Emoji 图标 ID（例如 "fluent-emoji:dog-face"） */
  target_icon?: string;
  /** 猫头鹰表情 */
  owl_tone: "happy" | "shocked" | "laughing" | "thoughtful" | "encouraging";
  /** 猫头鹰幽默吐槽（≤30 字） */
  owl_quip: string;
  /** 课堂引导问题（≤30 字） */
  guiding_question: string;
}

/** 完整响应（含已 resolve 的参考物对象，省得前端再查表） */
export interface ParseResponse extends ParsedInput {
  /** 已 resolve 的参考物对象列表 */
  resolved_refs: ReferenceObject[];
  /** 用户输入物匹配到的可复用视觉资源 */
  target_visual?: ResolvedVisual;
  /** 每个 ref_id 对应的可复用视觉资源 */
  ref_visuals?: Record<string, ResolvedVisual>;
  /**
   * 每个 ref_id 对应的 Iconify ID（来自 iconRegistry 服务端查找）。
   * 例如 { "haikou_bay_bridge": "openmoji:bridge-at-night", "pencil": "openmoji:pencil" }。
   * 前端 VisualCompare 优先使用这个，回退到内置硬编码 map。
   */
  ref_icons?: Record<string, string>;
  /** 这次响应来自 AI 还是 fallback */
  source: "ai" | "fallback";
  /**
   * catalog 流程中：用户输入物在 catalog 里没匹配，AI 给了 bake_suggestion，
   * 后端已 fire-and-forget 调 bake.py。此时 target_visual.iconId 指向尚未存在的 PNG，
   * 前端应轮询 /icons/pixel/<id>.png 直到 200 后热替换。
   */
  bake_pending?: boolean;
}

const SYSTEM_PROMPT = `你是"量感教练"AI——小学数学课白板智能助教。

任务：解析教师输入的"物体 + 数值 + 单位"，判断量感是否合理，挑选 2 个最适合做"等比例视觉对比"的参考物，生成幽默的猫头鹰（"尺博士"）吐槽和课堂引导问题。

强约束：
0. **绝对禁止擅自修改用户的数值或单位**——这是教学的核心铁律。
   - 用户说"蚂蚁长 5 米"就是 5 米，不是"老师打错了应该是 5 毫米"。**保持原样**返回 value 和 unit。
   - 离谱的输入正是教学契机——absurdity 字段标记荒谬程度，owl_quip 字段幽默吐槽，但 value/unit/value_in_si 必须忠实于原输入。
   - value_in_si 也按用户输入的 value+unit 换算（5 米 → 5），不能擅自改。
1. 你只能从给定的参考物 ID 池里挑选，**严禁编造新参考物**。
2. **只挑选 2 个参考物**——这 2 个会和用户输入物按**严格线性比例**画在同一画布上。
   小学生只能理解"按倍数对比"，所以**两个参考物的尺寸都必须严格落在 [用户值 ÷ 3, 用户值 × 3] 区间内**。
   - 1 个略小：约 0.33x ~ 0.95x
   - 1 个略大：约 1.05x ~ 3x
   - 例：用户"楼层 200 米" → 海口大悦城 168m（×0.84 ✓）、椰子树 25m（×0.13 ✗ 超出 1/3，不许选）。
   - 例：用户"椰子树 25 米" → 教室 8m（×0.32 ✓ 接近 1/3 边界）、十层楼 30m（×1.2 ✓）。
   - **荒谬输入**（如"蚂蚁 5 米"）也照此规则——挑 5/3 ≈ 1.67m 到 15m 之间的物体（小汽车 4.5m、教室 8m）。荒谬感由 owl_quip 文字承担，不要靠参考物悬殊的尺寸来表达。
   - 如果池子里 1/3~3x 范围内不足 2 个，宁可挑边界附近最接近的，也**不能选超出 3 倍的**——视觉对比会失真。
3. 选参考物的唯一判据是"尺寸接近 + 孩子熟悉"，**不要为了凑海南本地物而选不合适的物体**——hainan 标记仅作信息参考，不是优先级。
   - **绝对禁止把和用户输入物体同名（或一方包含另一方）的参考物列入** comparison_refs。例如用户问"椰子树高 25 米"，就不许再选 \`coconut_tree\` 当参考物——拿一个东西跟自己比毫无意义。
4. owl_quip 是猫头鹰幽默吐槽（≤30 字），要俏皮、有童趣、像和孩子说话。当数值合理时也可以是肯定鼓励语气。
5. guiding_question 是教师可以直接抛给全班的问题（≤30 字）。
6. absurdity 等级判断：用户值 / 该物体真实合理尺寸 的比值
   - 比值 in [0.5, 2]  → "none"（合理）
   - 比值 in [0.2, 5]  → "low"
   - 比值 in [0.05, 20] → "medium"
   - 比值 in [0.01, 100] → "high"
   - 其他 → "extreme"
7. **target_icon** 字段：从给定的 Iconify Fluent Emoji 图标白名单里挑一个最贴合用户输入物的图标 ID。
   - 必须以 \`fluent-emoji:\` 开头。
   - 优先选具象的物体图标，例如：狗→\`fluent-emoji:dog\`、足球场→\`fluent-emoji:stadium\`、椰子树→\`fluent-emoji:palm-tree\`。
   - **严禁使用 \`*-face\` 类只画"头部"的图标**（如 dog-face / cat-face / rabbit-face / tiger-face / horse-face / cow-face / pig-face / mouse-face）。
     这类头像无法代表整个物体的长度/身长——做尺寸对比时必须用**全身侧视图**（dog, cat, rabbit, tiger, horse, cow, pig, mouse 等无 -face 后缀的版本）。
   - 同理禁止用 paw-prints 代替具体动物，禁止用 soccer-ball 代替 stadium。
   - 如果白名单里找不到完美匹配，挑最接近的；实在没有就 \`fluent-emoji:triangular-ruler\`。
8. **返回纯 JSON 对象，禁止 markdown 代码块包装。**`;

function buildUserPrompt(
  text: string | undefined,
  object: string | undefined,
  value: number | undefined,
  unit: string | undefined,
  dimension: DimensionKey,
  excludeRefs: string[],
  detectedAxis: "horizontal" | "vertical",
): string {
  const refs = getReferencesForAI(dimension);
  const refList = refs
    .map(
      (r) =>
        `  - ${r.id} (${r.label}, 真实约 ${r.size} ${r.unit}, axis=${r.axis ?? "horizontal"})`,
    )
    .join("\n");
  // 维度决定要挑几个参照物。重量场景是"天平"隐喻，只挑 1 个；其它维度挑 2 个。
  const targetRefCount = refCountFor(dimension);
  // —— 数量描述文案（中文数词）+ 复数 hint
  const numWord = targetRefCount === 1 ? "1" : "2";
  const refCountPhrase =
    targetRefCount === 1
      ? "**正好 1 个**——重量维度使用天平模型，只对一个最贴近的参照物比较即可"
      : "**正好 2 个**";

  // 优先用"结构化字段"喂 AI——前置正则已经从原文里抽出 object/value/unit，
  // 再让 AI 重新解析原文容易出现"未知物体 / 单位='??' / value_in_si 错"的灾难，
  // 进而连带触发 pickIconWithSketchFallback 慢路径（数十秒级延迟，UI 看起来像卡住）。
  const haveStructured =
    !!object && Number.isFinite(value) && !!unit;
  const inputLine = haveStructured
    ? `教师输入字段：物体="${object}", 数值=${value}, 单位="${unit}"${
        text ? `（原文："${text}"）` : ""
      }`
    : text != null && text.trim() !== ""
      ? `教师输入原文：「${text}」`
      : `教师输入字段：物体="${object}", 数值=${value}, 单位="${unit}"`;

  const excludeBlock =
    excludeRefs.length > 0
      ? `\n⚠️ 本次**严格禁止**使用以下参考物 ID（上一轮已经用过，孩子要看新的对比）：
  ${excludeRefs.join(", ")}
你必须从剩余池子里挑 **${numWord} 个全新的** id，**都不能在禁用列表里**，否则视为失败。
`
      : "";

  const axisHint = `\n🎯 **本次比较的轴向已锁定**：\`target_axis="${detectedAxis}"\`（${
    detectedAxis === "vertical" ? "高度对比——画在同一地面线上" : "长度/宽度对比——竖向堆叠"
  }）。
你**必须**：
- 在返回 JSON 里也填入 \`target_axis="${detectedAxis}"\`。
- 只挑 axis="${detectedAxis}" 或 "either" 的参考物，绝不混用。
`;

  return `${inputLine}

维度：${dimension}（length=长度 m, area=面积 m², volume=容积 L, cubic=体积 m³, weight=重量 kg, time=时间 s）${
    dimension === "area"
      ? `\n📐 本次是**面积**对比——单位是 m²（平方米）。比较"邮票多大""教室地面多大""操场多大"这类问题。
   - axis 概念不适用，前端会画成"并排正方形"，边长 ∝ √面积。
   - **9 倍范围**参照：用户值 ÷ 9 ≤ 参考物 size ≤ 用户值 × 9（边长 ∝ √面积，9 倍面积 = 3 倍边长，仍可视）。`
      : dimension === "volume"
        ? `\n🥤 本次是**容积**对比——单位是 L（升）。比较"杯子能装多少""瓶子多大""桶能装多少水"这类问题。
   - axis 概念不适用，前端会画成"并排立方体（带水位）"，棱长 ∝ ∛容积。
   - **64 倍范围**参照：用户值 ÷ 64 ≤ 参考物 size ≤ 用户值 × 64（棱长 ∝ ∛容积，64 倍容积 = 4 倍棱长，依然清晰）。`
        : dimension === "cubic"
          ? `\n📦 本次是**体积**对比——单位是 m³（立方米）。比较"魔方多大块""冰箱占多少空间""集装箱装多少东西"这类问题。
   - axis 概念不适用，前端会画成"并排立方体（等距投影）"，棱长 ∝ ∛体积。
   - **64 倍范围**参照：用户值 ÷ 64 ≤ 参考物 size ≤ 用户值 × 64（棱长 ∝ ∛体积，64 倍体积 = 4 倍棱长，依然清晰）。`
          : dimension === "weight"
            ? `\n⚖️ 本次是**重量**对比——单位是 kg（千克）。比较"苹果多重""书包压不压""大象多重"这类问题。
   - axis 概念不适用，前端会画成"横向重量条"——条长 ∝ 重量（线性）。
   - 3 倍范围参照：用户值 ÷ 3 ≤ 参考物 size ≤ 用户值 × 3（作用于重量值）。`
            : dimension === "time"
              ? `\n⏰ 本次是**时间**对比——单位是 s（秒）。比较"眨眼多久""一节课多长""一年多长"这类问题。
   - axis 概念不适用，前端会画成"横向时间条"——条长 ∝ 时间（线性）。
   - 3 倍范围参照：用户值 ÷ 3 ≤ 参考物 size ≤ 用户值 × 3（作用于时间值）。`
              : ""
  }
${axisHint}${excludeBlock}
可用参考物（必须从此池中挑选 ${refCountPhrase}，使用 id）：
${refList}

【挑参考物的核心铁律】
1. **轴向必须一致**：长度跟长度比、高度跟高度比，绝不混用。
   - 如果用户问的是"长 / 长度 / 多长"（横向延伸：车、桥、跑道、绳子、动物身长…），
     **只挑 axis="horizontal" 或 "either" 的参考物**——禁止使用 axis="vertical" 的"身高/楼高/树高/山高"。
   - 如果用户问的是"高 / 多高 / 身高 / 楼高"（竖向），
     **只挑 axis="vertical" 或 "either" 的参考物**。
   - 用户没明说就看物体常识：车、动物身长、铅笔、桥 → 长度；人、楼、树、山、塔 → 高度。
2. 尺寸要紧邻用户值（前面已说过）。
3. 不要为了凑海南本地物而选轴向不对的物体。

target_icon 可选图标白名单（必须从中挑一个；Iconify Fluent Emoji）：
${ICON_WHITELIST.join(", ")}

请返回 JSON 对象，字段如下：
{
  "object": "物体名（中文）",
  "object_type": "物体类别（building/vehicle/body/animal/stationery/furniture/nature/ ...）",
  "value": 数值,
  "unit": "原始单位",
  "dimension": "${dimension}",
  "value_in_si": 归一化的 SI 数值,
  "absurdity": "none|low|medium|high|extreme",
  "comparison_refs": [${targetRefCount === 1 ? "\"id1\"" : "\"id1\", \"id2\""}],
  "target_icon": "fluent-emoji:xxx",
  "owl_tone": "happy|shocked|laughing|thoughtful|encouraging",
  "owl_quip": "猫头鹰幽默吐槽，≤30字",
  "guiding_question": "课堂引导问题，≤30字"
}`;
}

/**
 * Iconify Fluent Emoji 图标白名单——只给 AI 这些选项，避免它编一个不存在的图标。
 * 覆盖小学量感教学常见物品。如需扩展直接往下加。
 */
const ICON_WHITELIST: string[] = [
  // —— 动物（强制使用"全身侧视图"，禁止 *-face 头像，否则无法代表身长） ——
  "fluent-emoji:dog",
  "fluent-emoji:cat",
  "fluent-emoji:rabbit",
  "fluent-emoji:mouse",
  "fluent-emoji:pig",
  "fluent-emoji:cow",
  "fluent-emoji:horse",
  "fluent-emoji:tiger",
  "fluent-emoji:lion",
  "fluent-emoji:panda",
  "fluent-emoji:elephant",
  "fluent-emoji:whale",
  "fluent-emoji:dolphin",
  "fluent-emoji:fish",
  "fluent-emoji:octopus",
  "fluent-emoji:bird",
  "fluent-emoji:chicken",
  "fluent-emoji:eagle",
  "fluent-emoji:butterfly",
  "fluent-emoji:ant",
  "fluent-emoji:bug",
  "fluent-emoji:beetle",
  "fluent-emoji:honeybee",
  "fluent-emoji:snake",
  "fluent-emoji:snail",
  "fluent-emoji:turtle",
  "fluent-emoji:dinosaur",
  "fluent-emoji:t-rex",

  // —— 人 / 身体 ——
  "fluent-emoji:person-standing",
  "fluent-emoji:child",
  "fluent-emoji:baby",
  "fluent-emoji:older-person",
  "fluent-emoji:raising-hands",
  "fluent-emoji:thumbs-up",
  "fluent-emoji:foot",
  "fluent-emoji:hand-with-fingers-splayed",

  // —— 交通工具 ——
  "fluent-emoji:automobile",
  "fluent-emoji:taxi",
  "fluent-emoji:bus",
  "fluent-emoji:articulated-lorry",
  "fluent-emoji:delivery-truck",
  "fluent-emoji:motor-scooter",
  "fluent-emoji:bicycle",
  "fluent-emoji:high-speed-train",
  "fluent-emoji:bullet-train",
  "fluent-emoji:locomotive",
  "fluent-emoji:airplane",
  "fluent-emoji:helicopter",
  "fluent-emoji:rocket",
  "fluent-emoji:police-car",
  "fluent-emoji:fire-engine",
  "fluent-emoji:ambulance",
  "fluent-emoji:tractor",

  // —— 建筑 / 场所 ——
  "fluent-emoji:office-building",
  "fluent-emoji:school",
  "fluent-emoji:classical-building",
  "fluent-emoji:house",
  "fluent-emoji:tokyo-tower",
  "fluent-emoji:bridge-at-night",
  "fluent-emoji:stadium",
  "fluent-emoji:statue-of-liberty",
  "fluent-emoji:hospital",
  "fluent-emoji:bank",
  "fluent-emoji:church",
  "fluent-emoji:mosque",
  "fluent-emoji:hotel",
  "fluent-emoji:convenience-store",
  "fluent-emoji:department-store",

  // —— 自然 ——
  "fluent-emoji:deciduous-tree",
  "fluent-emoji:evergreen-tree",
  "fluent-emoji:palm-tree",
  "fluent-emoji:cactus",
  "fluent-emoji:snow-capped-mountain",
  "fluent-emoji:mountain",
  "fluent-emoji:volcano",
  "fluent-emoji:desert-island",
  "fluent-emoji:beach-with-umbrella",
  "fluent-emoji:sunrise-over-mountains",
  "fluent-emoji:cloud",
  "fluent-emoji:sun",
  "fluent-emoji:rainbow",
  "fluent-emoji:droplet",

  // —— 文具 / 工具 ——
  "fluent-emoji:pencil",
  "fluent-emoji:pen",
  "fluent-emoji:paintbrush",
  "fluent-emoji:straight-ruler",
  "fluent-emoji:triangular-ruler",
  "fluent-emoji:books",
  "fluent-emoji:notebook",
  "fluent-emoji:open-book",
  "fluent-emoji:scissors",
  "fluent-emoji:briefcase",
  "fluent-emoji:school-backpack",
  "fluent-emoji:chopsticks",

  // —— 家具 / 居家 ——
  "fluent-emoji:chair",
  "fluent-emoji:couch-and-lamp",
  "fluent-emoji:bed",
  "fluent-emoji:door",
  "fluent-emoji:window",
  "fluent-emoji:bathtub",
  "fluent-emoji:toilet",

  // —— 食物 ——
  "fluent-emoji:red-apple",
  "fluent-emoji:banana",
  "fluent-emoji:watermelon",
  "fluent-emoji:grapes",
  "fluent-emoji:hamburger",
  "fluent-emoji:pizza",
  "fluent-emoji:bread",
  "fluent-emoji:cookie",
  "fluent-emoji:cake",
  "fluent-emoji:ice-cream",

  // —— 运动 / 球类 ——
  "fluent-emoji:soccer-ball",
  "fluent-emoji:basketball",
  "fluent-emoji:baseball",
  "fluent-emoji:tennis",
  "fluent-emoji:ping-pong",
  "fluent-emoji:volleyball",
  "fluent-emoji:badminton",
  "fluent-emoji:person-running",
  "fluent-emoji:person-swimming",

  // —— 电子 / 杂项 ——
  "fluent-emoji:mobile-phone",
  "fluent-emoji:laptop",
  "fluent-emoji:television",
  "fluent-emoji:camera",
  "fluent-emoji:watch",
  "fluent-emoji:light-bulb",
  "fluent-emoji:battery",
  "fluent-emoji:balloon",
  "fluent-emoji:soap",
  "fluent-emoji:seedling",
  "fluent-emoji:coin",
  "fluent-emoji:money-bag",
  "fluent-emoji:gem-stone",

  // —— 兜底 ——
  "fluent-emoji:triangular-ruler",
];

/** Iconify ID 是否在白名单内 */
function isValidIcon(id?: string): boolean {
  return !!id && ICON_WHITELIST.includes(id);
}

/**
 * AI 即使写了 *-face 头像类图标，也兜底替换为全身图。
 * 这是第三道防线（白名单已经移除 + 提示词已经禁止之外的兜底）。
 */
const FACE_FALLBACK_MAP: Record<string, string> = {
  "fluent-emoji:dog-face": "fluent-emoji:dog",
  "fluent-emoji:cat-face": "fluent-emoji:cat",
  "fluent-emoji:rabbit-face": "fluent-emoji:rabbit",
  "fluent-emoji:mouse-face": "fluent-emoji:mouse",
  "fluent-emoji:pig-face": "fluent-emoji:pig",
  "fluent-emoji:cow-face": "fluent-emoji:cow",
  "fluent-emoji:horse-face": "fluent-emoji:horse",
  "fluent-emoji:tiger-face": "fluent-emoji:tiger",
  "fluent-emoji:lion-face": "fluent-emoji:lion",
};

/** 把 AI 给的图标 ID 规范化：先做头像→全身替换，再做白名单校验 */
function normalizeTargetIcon(id?: string): string | undefined {
  if (!id) return undefined;
  const mapped = FACE_FALLBACK_MAP[id] ?? id;
  return isValidIcon(mapped) ? mapped : undefined;
}

/** 兜底逻辑：当 DeepSeek 失败时返回一个可用的 deterministic JSON */
async function buildFallback(
  text: string,
  object: string,
  value: number,
  unit: string,
  dimension: DimensionKey,
  /** 必须避开的 ID，用于"换两个对比"按钮的 fallback 路径 */
  excludeRefs: string[] = [],
  /** 锁定的轴向；不传时按 horizontal */
  detectedAxis: "horizontal" | "vertical" = "horizontal",
): Promise<ParseResponse> {
  const valueInSi =
    toSI(value, unit, dimension) ?? value;

  const excludeSet = new Set(excludeRefs);

  // 倍数范围（小学生只理解线性比例对比）：
  //  - 长度/重量/时间：直接线性 → 3×
  //  - 面积：边长 ∝ √面积，9× 面积 = 3× 边长，仍可视
  //  - 体积/容积：棱长 ∝ ∛体积，64× 体积 = 4× 棱长，依然清晰
  //   （否则像"骰子 1cm³"这类小物，库里没东西能撑住 3× 范围）
  const { RATIO_MIN, RATIO_MAX } = ratioBoundsFor(dimension);
  const inRange = (size: number) => {
    if (!Number.isFinite(valueInSi) || valueInSi <= 0 || size <= 0) return true;
    const r = size / valueInSi;
    return r >= RATIO_MIN && r <= RATIO_MAX;
  };

  // 同轴匹配
  const axisOk = (refAxis: string | undefined) => {
    const a = refAxis ?? "horizontal";
    return a === detectedAxis || a === "either";
  };
  // 同名物体过滤
  const targetNameFb = (object || text || "").trim();
  const isSameAsTargetFb = (refLabel: string) => {
    if (!targetNameFb) return false;
    const a = targetNameFb;
    const b = refLabel.trim();
    return a === b || a.includes(b) || b.includes(a);
  };

  // 候选池：先硬过滤"同轴 + 同名排除 + exclude 排除"，再按距离排序
  // ⚠️ axisOk 必须是**过滤条件**，不是排序键——之前用作 sort key 导致 horizontal 物体
  //    被混进 vertical 对比（"椰子树高 25m" 拿到了 "校车 11m" + "篮球场 28m"）
  const refsAll = getReferencesForAI(dimension)
    .filter(
      (r) =>
        r.size > 0 &&
        !excludeSet.has(r.id) &&
        !isSameAsTargetFb(r.label) &&
        axisOk(r.axis),
    )
    .map((r) => ({
      ...r,
      ratio: valueInSi / r.size,
      inRange: inRange(r.size),
      distance: Math.abs(Math.log(valueInSi / r.size)),
    }))
    .sort((a, b) => {
      // 范围内 > 范围外；范围内里距离近 > 距离远
      if (a.inRange !== b.inRange) return a.inRange ? -1 : 1;
      return a.distance - b.distance;
    });

  // 严格 3 倍范围内挑小 + 大各 1 个。
  // —— 重量维度 refCountFor=1，只保留"最近的那一个"（天平隐喻）。
  const targetRefCount = refCountFor(dimension);
  const inBand = refsAll.filter((r) => r.inRange);
  const smaller = inBand.find((r) => r.size < valueInSi);
  const bigger = inBand.find((r) => r.size > valueInSi);

  // weight 单参照：取距离最近的那一个；其它维度：小 + 大
  const candidates =
    targetRefCount === 1
      ? [inBand[0]?.id] // refsAll 已按距离升序，inBand[0] = 最贴近的同向参照
      : [smaller?.id, bigger?.id];
  let picked = Array.from(
    new Set(candidates.filter(Boolean) as string[]),
  ).slice(0, targetRefCount);

  // ⚠️ 兜底中的兜底：库太稀疏导致 3× 内 0 个候选时（典型例：鸡蛋 55g
  //    周围只有 1 元硬币 6g 和苹果 200g，都被严格 3× 卡掉）→ 放宽到软上限
  //    LOOSE_LOG = ln(10)（即 10×），用最近的填上；宁可"略失真"也不要空舞台。
  if (picked.length < targetRefCount && refsAll.length > 0) {
    const LOOSE_LOG = Math.log(10);
    for (const r of refsAll) {
      if (picked.length >= targetRefCount) break;
      if (picked.includes(r.id)) continue;
      if (r.distance > LOOSE_LOG) break; // refsAll 已按 distance 升序
      picked.push(r.id);
    }
    picked = Array.from(new Set(picked)).slice(0, targetRefCount);
  }

  const nearest = smaller ?? bigger ?? refsAll[0];
  const ratio = nearest ? valueInSi / nearest.size : 1;

  // 荒谬度判定：基于"日常物体在该维度下的典型量级范围"的绝对阈值。
  //
  // 注意：不要用 valueInSi vs 最近参考物的 ratio——参考物本来就是按"接近
  // valueInSi"挑的，那是循环逻辑，永远输出 ~1，导致离谱输入也被夸"差
  // 不多就这么大呢"。例子：用户"书包 8 公里"会挑到"海口湾跨海大桥 5km"
  // → ratio≈1.6 → absurdity=none → 错误。
  //
  // 这里给每个维度划一个"日常合理带"，user 值越往外越荒谬。若 AI 路径
  // 可用，这条 fallback 不会被执行；它只是 AI 调用失败时的兜底。
  const everydayRange: Record<DimensionKey, [number, number]> = {
    // 1 mm ~ 100 m：从蚂蚁腿到一栋楼
    length: [1e-3, 1e2],
    // 1 cm² ~ 1 公顷：从邮票到操场
    area: [1e-4, 1e4],
    // 1 mL ~ 1 m³：从一滴水到大水箱
    volume: [1e-6, 1],
    cubic: [1e-6, 1],
    // 1 g ~ 1 吨：从羽毛到大象
    weight: [1e-3, 1e3],
    // 1 秒 ~ 1 年：从眨眼到生日
    time: [1, 3.15e7],
  };
  let absurdity: ParsedInput["absurdity"] = "none";
  const [okLo, okHi] = everydayRange[dimension] ?? [0, Infinity];
  const overshoot = Math.max(
    valueInSi > okHi ? Math.log10(valueInSi / okHi) : 0,
    valueInSi > 0 && valueInSi < okLo ? Math.log10(okLo / valueInSi) : 0,
  );
  if (overshoot > 3) absurdity = "extreme";       // 偏离上下界 1000× 以上
  else if (overshoot > 1.5) absurdity = "high";   // 30× ~ 1000×
  else if (overshoot > 0.5) absurdity = "medium"; // 3× ~ 30×
  else if (overshoot > 0) absurdity = "low";      // 刚好越界

  const resolved = picked
    .map((id) => REFERENCE_MAP[id])
    .filter(Boolean) as ReferenceObject[];

  // fallback 路径也给图标——保证前端始终有 iconifyId 可用
  const fallbackTargetIcon = pickIcon(object || text || "").id ?? undefined;
  const fallbackRefIcons: Record<string, string> = {};
  const fallbackRefVisuals: Record<string, ResolvedVisual> = {};
  for (const ref of resolved) {
    const r = pickIcon(ref.label);
    if (r.id) fallbackRefIcons[ref.id] = r.id;
    // catalog 优先：用按 label/aliases 匹配的"已烤 PNG"覆盖维度后缀 ID。
    // 例：apple_weight ref → catalog "苹果"(id=apple) → pixel-png:apple
    const catHit = await findCatalogEntryByName(ref.label);
    fallbackRefVisuals[ref.id] = catHit
      ? {
          assetId: catHit.id,
          label: ref.label,
          iconId: `pixel-png:${catHit.id}`,
          source: "asset",
        }
      : resolveVisualForReference(ref);
  }
  // 目标 visual：catalog 优先（与 AI 路径同逻辑）
  const fbTargetName = object || text || "";
  const fbTargetCatHit = await findCatalogEntryByName(fbTargetName);
  const fallbackTargetVisual: ResolvedVisual = fbTargetCatHit
    ? {
        assetId: fbTargetCatHit.id,
        label: fbTargetCatHit.label,
        iconId: `pixel-png:${fbTargetCatHit.id}`,
        source: "asset",
      }
    : resolveVisualForTarget(fbTargetName);

  return {
    object: object || text || "未知物体",
    object_type: "unknown",
    value,
    unit,
    dimension,
    value_in_si: valueInSi,
    target_axis: detectedAxis,
    absurdity,
    comparison_refs: picked,
    target_icon: fallbackTargetIcon,
    owl_tone:
      absurdity === "none"
        ? "happy"
        : absurdity === "extreme" || absurdity === "high"
          ? "shocked"
          : "thoughtful",
    owl_quip:
      absurdity === "none"
        ? `嗯，${object || "这个"}差不多就这么大呢～`
        : // 方向用"相对日常带"判断，不要用 ratio（参考物没选到时 ratio 恒为 1
          //   会错判方向）。例：卡车 8 千米，没有 km 量级的卡车类参考 → ratio=1
          //   → 旧逻辑说"有这么小吗"，明显反了。
          `咦？${object || "这个"}有这么${valueInSi > okHi ? "大" : "小"}吗？`,
    guiding_question:
      "小朋友们想想看，这个尺寸合理吗？",
    resolved_refs: resolved,
    target_visual: fallbackTargetVisual,
    ref_visuals: fallbackRefVisuals,
    ref_icons: fallbackRefIcons,
    source: "fallback",
  };
}

// ============================================================================
// catalog 协议（Phase 1：仅长度维度）
//
// 设计：让 AI 直接从 visual-assets.json 的 1000+ 条目里挑目标 id 与参考 id，
// 并由 AI 给出每个参考物在锁定轴向上的典型尺寸（米）。后端只做白名单校验、
// PNG 存在性校验、3× 范围校验、合成 ReferenceObject。
//
// 这是沙盒模式的「图像宇宙 = catalog」第一性原理实现，跳过 references.ts。
// ============================================================================

interface CatalogParsed {
  target_catalog_id: string | null;
  object_type: string;
  absurdity: ParsedInput["absurdity"];
  refs: Array<{
    catalog_id: string;
    typical_size_m: number;
    reason?: string;
  }>;
  owl_tone: ParsedInput["owl_tone"];
  owl_quip: string;
  guiding_question: string;
  /**
   * 当 target_catalog_id=null 时，AI 应给出"应该烤一张这种图"的建议：
   *   - id: kebab/snake [a-z0-9_-]，如 "luxury_cruise_ship"
   *   - label: 中文显示名
   *   - aliases: 同义词
   *   - axis: horizontal | vertical | either | square
   *   - category: 自由类别词
   *   - prompt: 给 SDXL 的英文 prompt 主体（不要加风格后缀，bake.py 会补）
   */
  bake_suggestion?: {
    id: string;
    label: string;
    aliases?: string[];
    axis?: CatalogEntry["axis"];
    category?: string;
    prompt: string;
  } | null;
}

const CATALOG_LENGTH_SYSTEM_PROMPT = `你是"量感教练"AI——小学数学课白板智能助教。

任务：根据用户输入的"物体 + 长度数值 + 单位"，从给定 catalog 视觉清单中：
1. 给"用户输入物体"挑一个最贴合的 catalog_id（target_catalog_id）。清单里没有合适匹配则返回 null。
2. 挑出**正好 2 个**最适合视觉对比的参考物 catalog_id，并报出它们在指定**轴向**上的典型尺寸（米）。
3. 评估荒谬度（absurdity）+ 生成猫头鹰幽默吐槽（owl_quip ≤30 字）+ 课堂引导问题（guiding_question ≤30 字）。

铁律：
0. comparison_refs 只能从给定 catalog 里挑，**严禁编造**。
1. 严禁擅自修改用户的数值或单位（铁律）。
2. 你给的 typical_size_m 必须是该物体在指定轴向上的真实典型尺寸，单位**米**。
   例：校车长 11、椰子树高 25、海口湾大桥长 5300、铅笔长 0.18、蚂蚁长 0.005。
3. 严禁选和用户输入物体同名（或包含关系）的参考物——和自己比毫无意义。
4. 严禁选超出 [用户值÷3, 用户值×3] 范围的参考物——小学生只能理解线性比例对比。
   - 一个略小（≈0.33×~0.95×）+ 一个略大（≈1.05×~3×）。
   - 找不到刚好 2 个就只给 1 个，绝不能选超 3 倍的。
5. **荒谬输入**（如"蚂蚁长 5 米"）也照此规则：挑 5/3 ≈ 1.67m 到 15m 之间的物体。荒谬感由 owl_quip 文字承担。
6. owl_tone ∈ {happy, shocked, laughing, thoughtful, encouraging}。

【target_catalog_id 与 bake_suggestion】
- 优先在 catalog 里找一个**真正贴切**的 id 给 target_catalog_id（aliases 也算命中）。同义匹配优先：用户说"航母"⇨ catalog 的 "aircraft_carrier" 命中。
- 只有当 catalog 里**完全没有合适匹配**（不是凑合的近似）时，才把 target_catalog_id=null，并给出 bake_suggestion：
  {
    "id": "snake_case 英文 id, [a-z0-9_-]",
    "label": "用户的中文物体名（去掉单位）",
    "aliases": ["同义词"],
    "axis": "horizontal|vertical|either|square",
    "category": "vehicle|animal|building|nature|...",
    "prompt": "single isolated <object>, side view, clear silhouette"
  }
  bake_suggestion.prompt 用英文，仅描述物体本体（不加 'pixel art' 风格词，bake.py 自带后缀）。
- catalog 命中时 bake_suggestion 必须为 null。

7. **返回纯 JSON 对象，禁止 markdown 包装。**`;

function buildCatalogLengthUserPrompt(params: {
  text: string;
  object: string;
  value: number;
  unit: string;
  detectedAxis: "horizontal" | "vertical";
  candidates: CatalogEntry[];
  excludeRefs: string[];
}): string {
  const { text, object, value, unit, detectedAxis, candidates, excludeRefs } =
    params;
  const inputLine =
    text && text.trim()
      ? `教师输入原文：「${text}」`
      : `物体="${object}", 数值=${value}, 单位="${unit}"`;
  const excludeBlock =
    excludeRefs.length > 0
      ? `\n⚠️ 严禁使用下列 id（已用过）：${excludeRefs.join(", ")}\n`
      : "";
  const list = candidates.map((c) => `  - ${entryToLlmLine(c)}`).join("\n");
  return `${inputLine}\n\n维度：length（SI 单位 m）\n锁定轴向：target_axis="${detectedAxis}"（${
    detectedAxis === "vertical" ? "高度" : "长度/水平延伸"
  }）\n${excludeBlock}\n可用 catalog（已按轴向预过滤；每行格式：\`id (label, axis aka:别名)\`）：\n${list}\n\n请返回 JSON 对象：\n{\n  "target_catalog_id": "id_or_null",\n  "object_type": "vehicle|animal|building|...",\n  "absurdity": "none|low|medium|high|extreme",\n  "refs": [\n    { "catalog_id": "id1", "typical_size_m": 11 },\n    { "catalog_id": "id2", "typical_size_m": 30 }\n  ],\n  "owl_tone": "happy|shocked|laughing|thoughtful|encouraging",\n  "owl_quip": "≤30字",\n  "guiding_question": "≤30字",\n  "bake_suggestion": null  // catalog 命中时填 null；找不到时填 {id,label,aliases,axis,category,prompt}\n}`;
}

function synthesizeRefFromCatalog(
  entry: CatalogEntry,
  sizeM: number,
  dimension: DimensionKey,
): ReferenceObject {
  const allowedCats = new Set([
    "tiny",
    "stationery",
    "body",
    "furniture",
    "vehicle",
    "animal",
    "building",
    "nature",
    "hainan",
    "world",
    "astronomy",
    "food",
    "school",
    "entertainment",
  ]);
  const cat = allowedCats.has(entry.category)
    ? (entry.category as ReferenceObject["category"])
    : "world";
  const axis: ReferenceObject["axis"] =
    entry.axis === "square" || entry.axis === "either"
      ? "either"
      : (entry.axis ?? "horizontal");
  return {
    id: entry.id,
    label: entry.label,
    emoji: "", // catalog 流程靠 pixel-png 渲染，emoji 仅占位
    dimension,
    size: sizeM,
    unit: "m",
    sizeDisplay: formatLength(sizeM),
    category: cat,
    axis,
  };
}

async function tryCatalogFlowForLength(params: {
  request: NextRequest;
  text: string;
  object: string;
  value: number;
  unit: string;
  excludeRefs: string[];
  detectedAxis: "horizontal" | "vertical";
}): Promise<ParseResponse | null> {
  const { request, text, object, value, unit, excludeRefs, detectedAxis } =
    params;

  const candidatesAll = await getAvailableForLengthAxis(detectedAxis);
  const targetName = (object || text || "").trim();
  const containsBoth = (a: string, b: string) =>
    a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
  const sameAsTarget = (label: string, aliases?: string[]) => {
    if (!targetName) return false;
    if (containsBoth(targetName, label.trim())) return true;
    if (aliases) {
      for (const a of aliases) {
        if (containsBoth(targetName, a.trim())) return true;
      }
    }
    return false;
  };
  const excludeSet = new Set(excludeRefs);
  const candidates = candidatesAll.filter(
    (c) => !excludeSet.has(c.id) && !sameAsTarget(c.label, c.aliases),
  );
  if (candidates.length === 0) return null;

  let parsed: CatalogParsed;
  try {
    parsed = await chatJSON<CatalogParsed>(
      [
        { role: "system", content: CATALOG_LENGTH_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildCatalogLengthUserPrompt({
            text,
            object,
            value,
            unit,
            detectedAxis,
            candidates,
            excludeRefs,
          }),
        },
      ],
      { temperature: 0.5, timeoutMs: 18_000 },
    );
  } catch (e) {
    console.warn(
      "[parse/catalog] LLM 失败，回退到 references.ts：",
      e instanceof DeepSeekError ? e.message : String(e),
    );
    return null;
  }

  if (!parsed || !Array.isArray(parsed.refs)) return null;

  const valueInSi = toSI(value, unit, "length") ?? value;
  const RATIO_MIN = 1 / 3;
  const RATIO_MAX = 3;
  const inRange = (s: number) =>
    !Number.isFinite(valueInSi) ||
    valueInSi <= 0 ||
    s <= 0 ||
    (s >= valueInSi * RATIO_MIN && s <= valueInSi * RATIO_MAX);

  const validated: ReferenceObject[] = [];
  const seenIds = new Set<string>();
  for (const r of parsed.refs) {
    if (!r || typeof r.catalog_id !== "string") continue;
    if (seenIds.has(r.catalog_id) || excludeSet.has(r.catalog_id)) continue;
    const entry = await getCatalogEntry(r.catalog_id);
    if (!entry) continue;
    if (!(await hasPng(r.catalog_id))) continue;
    if (sameAsTarget(entry.label, entry.aliases)) continue;
    const sm = Number(r.typical_size_m);
    if (!Number.isFinite(sm) || sm <= 0) continue;
    if (!inRange(sm)) continue;
    const ax = entry.axis ?? "horizontal";
    if (ax !== detectedAxis && ax !== "either" && ax !== "square") continue;
    seenIds.add(r.catalog_id);
    validated.push(synthesizeRefFromCatalog(entry, sm, "length"));
    if (validated.length >= 2) break;
  }
  if (validated.length === 0) return null;

  // 目标视觉：
  // 1) catalog 命中（target_catalog_id 在表 + PNG 已烤）→ 用本地 PNG
  // 2) catalog 未命中但 AI 给了 bake_suggestion → 追加 catalog + fire-and-forget 烤，
  //    返回的 iconId 指向尚未存在的 PNG，bake_pending=true，前端轮询热替换
  // 3) 兜底走旧 visualAssets
  //
  // 本地兜底：AI 有时（特别是"换两个对比"反复调用导致上下文变化时）会返回
  //   target_catalog_id=null，把"卡车"这种 catalog 里明明有的物体也漏掉。
  //   旧逻辑直接走 resolveVisualForTarget 会落到 generated:，前端拿不到 PNG
  //   就显示问号。这里先按名字在 catalog 里再找一次——和 fallback 路径
  //   行为一致——找到了就用本地 PNG，找不到才退回 legacy。
  const resolveTargetLocally = async (): Promise<ResolvedVisual> => {
    const name = (object || text || "").trim();
    if (name) {
      const hit = await findCatalogEntryByName(name);
      if (hit && (await hasPng(hit.id))) {
        return {
          assetId: hit.id,
          label: hit.label,
          iconId: `pixel-png:${hit.id}`,
          source: "asset",
        };
      }
    }
    return resolveVisualForTarget(name);
  };
  let targetVisual: ResolvedVisual;
  let bakePending = false;
  if (
    parsed.target_catalog_id &&
    typeof parsed.target_catalog_id === "string"
  ) {
    const tEntry = await getCatalogEntry(parsed.target_catalog_id);
    if (tEntry && (await hasPng(tEntry.id))) {
      targetVisual = {
        assetId: tEntry.id,
        label: tEntry.label,
        iconId: `pixel-png:${tEntry.id}`,
        source: "asset",
      };
    } else {
      // AI 给的 catalog_id 在表里查无此物（或 PNG 还没烤）——别直接放弃，
      // 按名字在 catalog 里再找一次，往往就能命中真实条目。
      targetVisual = await resolveTargetLocally();
    }
  } else if (
    parsed.bake_suggestion &&
    typeof parsed.bake_suggestion === "object" &&
    typeof parsed.bake_suggestion.id === "string" &&
    typeof parsed.bake_suggestion.prompt === "string"
  ) {
    const sug = parsed.bake_suggestion;
    const idClean = sug.id.trim();
    if (/^[a-z0-9][a-z0-9_-]{0,63}$/.test(idClean)) {
      try {
        const axisOk: CatalogEntry["axis"] =
          sug.axis === "vertical" ||
          sug.axis === "horizontal" ||
          sug.axis === "either" ||
          sug.axis === "square"
            ? sug.axis
            : detectedAxis;
        await appendCatalogEntry({
          id: idClean,
          label: (sug.label ?? object ?? "").trim() || idClean,
          aliases: Array.isArray(sug.aliases) ? sug.aliases : undefined,
          category: (sug.category ?? "world").trim() || "world",
          axis: axisOk,
          prompt: sug.prompt.trim(),
        });
        // fire-and-forget 烤，避免阻塞
        void runBakeForId(idClean).catch((err) =>
          console.warn(`[parse/catalog] bake-on-demand ${idClean} 失败：`, err),
        );
        targetVisual = {
          assetId: idClean,
          label: (sug.label ?? object ?? idClean).trim(),
          iconId: `pixel-png:${idClean}`,
          source: "asset",
        };
        bakePending = true;
      } catch (err) {
        console.warn("[parse/catalog] 追加 catalog 失败：", err);
        targetVisual = await resolveTargetLocally();
      }
    } else {
      targetVisual = await resolveTargetLocally();
    }
  } else {
    // AI 返回 target_catalog_id=null 也没给 bake_suggestion——常见于
    // "换两个对比"反复调用后 AI 忘记填字段。先尝试本地 catalog 命中，
    // 命不中再退回 legacy visualAssets。这是问号 bug 的修复点。
    targetVisual = await resolveTargetLocally();
  }

  const refVisuals: Record<string, ResolvedVisual> = {};
  const refIcons: Record<string, string> = {};
  for (const r of validated) {
    refVisuals[r.id] = {
      assetId: r.id,
      label: r.label,
      iconId: `pixel-png:${r.id}`,
      source: "reference",
    };
    const ic = pickIcon(r.label);
    if (ic.id) refIcons[r.id] = ic.id;
  }

  // catalog 命中时 target_visual 已是本地 PNG，target_icon 仅作 Mascot/兜底；
  // 跳过昂贵的 sketch HTTP 内调，仅查本地 iconRegistry。
  const targetIconViaRegistry = {
    id: pickIcon(object || text || "").id,
    source: "library" as const,
  };
  void pickIconWithSketchFallback; // 仅保留 import 防 TS6133

  return {
    object: object || text || "",
    object_type: parsed.object_type ?? "unknown",
    value,
    unit,
    dimension: "length",
    value_in_si: valueInSi,
    target_axis: detectedAxis,
    absurdity: parsed.absurdity ?? "none",
    comparison_refs: validated.map((r) => r.id),
    target_icon: targetIconViaRegistry.id ?? undefined,
    owl_tone: parsed.owl_tone ?? "happy",
    owl_quip: parsed.owl_quip ?? "",
    guiding_question: parsed.guiding_question ?? "",
    resolved_refs: validated,
    target_visual: targetVisual,
    ref_visuals: refVisuals,
    ref_icons: refIcons,
    source: "ai",
    bake_pending: bakePending || undefined,
  };
}

// ============================================================================
// 时间维度自由生成协议（Phase 2：仅时间维度）
//
// 时间维度的可视化是"翻页日历"，**只显示数字**（年/月/日），不需要图标。
// 因此 AI 不必从 references.ts 受限挑选——它可以自由想象任何"孩子熟悉的时间段"
// （眨眼、打喷嚏、刷牙、听一首歌、看一集动画、做一道题、午休、暑假、小学六年…）。
//
// 流程：
//   1) AI 收到目标值 → 返回 { label, seconds, size_display } × 2（一短一长）
//   2) 后端校验：3× 范围、不同名、不重复、合法数字
//   3) 合成 ReferenceObject（id = "ai_time:<label>"，emoji/visual 占位空）
//   4) "换两个对比" 时把上轮 ID 列表反解回标签作为 exclude_labels 喂给 AI
// ============================================================================

const TIME_ID_PREFIX = "ai_time:";

interface FreeFormTimeParsed {
  object_type?: string;
  absurdity?: ParsedInput["absurdity"];
  refs?: Array<{
    label?: string;
    seconds?: number;
    size_display?: string;
  }>;
  owl_tone?: ParsedInput["owl_tone"];
  owl_quip?: string;
  guiding_question?: string;
}

const FREE_FORM_TIME_SYSTEM_PROMPT = `你是"量感教练"AI——小学时间量感教学助教。

任务：根据教师输入的"物体 + 时间数值"，自由生成 **正好 2 个** 贴近孩子生活、能形成"夹击式"对比的参考时长。

铁律：
1. 一个略短（≈ 用户值 × 0.33~0.95），一个略长（≈ 用户值 × 1.05~3）。
2. **参考完全自由发挥**：任何孩子熟悉的"一段时间"都可以——
   眨一次眼 0.3 秒、打喷嚏 0.6 秒、深呼吸 4 秒、做一道口算题 30 秒、刷一次牙 3 分钟、
   听一首歌 4 分钟、煮一颗鸡蛋 8 分钟、看一集动画 25 分钟、上一节课 40 分钟、
   一场动画电影 90 分钟、午睡 1 小时、坐高铁从海口到广州 4 小时、一整觉 9 小时、
   一个寒假 30 天、一个暑假 60 天、一学年 280 天、一年 365 天、小学 6 年…
   都行，只要孩子能直觉感受。
3. **严禁**和"输入物"同名（包含关系也算）。
4. **严禁修改用户的数值或单位**——铁律。
5. \`size_display\` 要友好可读，**用中文单位**："约 3 分钟" / "40 分钟" / "1.5 小时" / "约 30 天"。
6. \`seconds\` 必须是数字（秒）。换算关系：1 分=60，1 小时=3600，1 天=86400，1 年=86400×365。
7. **返回纯 JSON，禁止 markdown 代码块。**`;

function buildFreeFormTimePrompt(params: {
  text: string;
  object: string;
  value: number;
  unit: string;
  valueInSi: number;
  excludeLabels: string[];
}): string {
  const { text, object, value, unit, valueInSi, excludeLabels } = params;
  const inputLine =
    text && text.trim()
      ? `教师输入原文：「${text}」`
      : `物体="${object}", 数值=${value}, 单位="${unit}"`;
  const excludeBlock = excludeLabels.length
    ? `\n⚠️ 严禁使用以下标签（上轮用过，要换新的）：${excludeLabels.join("、")}\n`
    : "";
  return `${inputLine}
归一化值：${valueInSi} 秒
合理范围：[${(valueInSi / 3).toFixed(2)} 秒, ${(valueInSi * 3).toFixed(2)} 秒]
${excludeBlock}
请返回 JSON：
{
  "object_type": "activity|natural|holiday|...",
  "absurdity": "none|low|medium|high|extreme",
  "refs": [
    { "label": "刷一次牙", "seconds": 180, "size_display": "约 3 分钟" },
    { "label": "看一集动画", "seconds": 1500, "size_display": "25 分钟" }
  ],
  "owl_tone": "happy|shocked|laughing|thoughtful|encouraging",
  "owl_quip": "≤30 字",
  "guiding_question": "≤30 字"
}`;
}

async function tryFreeFormTimeFlow(params: {
  text: string;
  object: string;
  value: number;
  unit: string;
  excludeRefs: string[];
}): Promise<ParseResponse | null> {
  const { text, object, value, unit, excludeRefs } = params;
  const valueInSi = toSI(value, unit, "time") ?? value;
  if (!Number.isFinite(valueInSi) || valueInSi <= 0) return null;

  // exclude_refs 是上轮返回的 id 列表（"ai_time:<label>"），反解回标签喂给 AI
  const excludeLabels = excludeRefs
    .filter((s) => s.startsWith(TIME_ID_PREFIX))
    .map((s) => s.slice(TIME_ID_PREFIX.length));

  let parsed: FreeFormTimeParsed;
  try {
    parsed = await chatJSON<FreeFormTimeParsed>(
      [
        { role: "system", content: FREE_FORM_TIME_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildFreeFormTimePrompt({
            text,
            object,
            value,
            unit,
            valueInSi,
            excludeLabels,
          }),
        },
      ],
      { temperature: 0.8, timeoutMs: 12_000 },
    );
  } catch (e) {
    console.warn(
      "[parse/time-free] LLM 失败，回退到 references.ts：",
      e instanceof DeepSeekError ? e.message : String(e),
    );
    return null;
  }

  if (!parsed || !Array.isArray(parsed.refs)) return null;

  // 校验 + 合成 ReferenceObject
  const RATIO_MIN = 1 / 3;
  const RATIO_MAX = 3;
  const targetName = (object || text || "").trim();
  const isSameAsTarget = (label: string) => {
    if (!targetName) return false;
    const a = targetName;
    const b = label.trim();
    return a === b || a.includes(b) || b.includes(a);
  };
  const excludeLabelSet = new Set(excludeLabels);

  const resolved: ReferenceObject[] = [];
  const seenLabels = new Set<string>();
  for (const r of parsed.refs) {
    if (!r || typeof r.label !== "string") continue;
    const label = r.label.trim();
    if (!label) continue;
    if (seenLabels.has(label) || excludeLabelSet.has(label)) continue;
    if (isSameAsTarget(label)) continue;
    const s = Number(r.seconds);
    if (!Number.isFinite(s) || s <= 0) continue;
    const ratio = s / valueInSi;
    if (ratio < RATIO_MIN || ratio > RATIO_MAX) continue;
    seenLabels.add(label);
    resolved.push({
      id: `${TIME_ID_PREFIX}${label}`,
      label,
      emoji: "", // 时间维度不展示图，emoji 仅占位
      dimension: "time",
      size: s,
      unit: "s",
      sizeDisplay:
        typeof r.size_display === "string" && r.size_display.trim()
          ? r.size_display.trim()
          : `${s} 秒`,
      category: "world",
      axis: "either",
    });
    if (resolved.length >= 2) break;
  }
  if (resolved.length === 0) return null;

  return {
    object: object || text || "未知",
    object_type: parsed.object_type ?? "activity",
    value,
    unit,
    dimension: "time",
    value_in_si: valueInSi,
    target_axis: "horizontal", // 时间不区分轴向，前端不读
    absurdity: parsed.absurdity ?? "none",
    comparison_refs: resolved.map((r) => r.id),
    target_icon: undefined,
    owl_tone: parsed.owl_tone ?? "happy",
    owl_quip: parsed.owl_quip ?? "",
    guiding_question: parsed.guiding_question ?? "",
    resolved_refs: resolved,
    target_visual: undefined,
    ref_visuals: {},
    ref_icons: {},
    source: "ai",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      object?: string;
      value?: number;
      unit?: string;
      dimension?: DimensionKey;
      /** 必须避开的参考物 ID 列表（用于"换一组参照"按钮） */
      exclude_refs?: string[];
    };

    const dimension: DimensionKey = body.dimension ?? "length";
    const text = body.text ?? "";
    let object = body.object ?? "";
    let value = typeof body.value === "number" ? body.value : NaN;
    let unit = body.unit ?? "";

    // 从原文里嗅探"长/高"动词决定渲染轴向。
    // 优先级：高（最强信号）> 长/宽/厚 > 默认 horizontal
    let detectedAxis: "horizontal" | "vertical" = "horizontal";
    if (/高/.test(text)) detectedAxis = "vertical";
    else if (/长|宽|厚/.test(text)) detectedAxis = "horizontal";

    // 仅给了 text 时，前端没结构化的字段——做一次正则抽取作为"AI 失败 → fallback"路径的兜底。
    // 优先级：体积/面积/容积单位（带"立方/平方/升/毫升"等）必须先匹配，否则 "立方米" 会被截成 "米"。
    if (text && (!object || !Number.isFinite(value) || !unit)) {
      const weightRe =
        /^\s*(.+?)\s*(?:重|重量|的重量)?\s*(?:是|有|约)?\s*([0-9]+(?:\.[0-9]+)?)\s*(毫克|克|公克|千克|公斤|吨|公吨|mg|g|kg|t)\s*$/i;
      const timeRe =
        /^\s*(.+?)\s*(?:用|花|需要|时间|的时间|持续)?\s*(?:是|有|约)?\s*([0-9]+(?:\.[0-9]+)?)\s*(毫秒|秒|分钟|分|小时|时|天|日|星期|周|个月|月|年|ms|s|min|h)\s*$/i;
      const cubicRe =
        /^\s*(.+?)\s*(?:体积|的体积|占)?\s*(?:是|有|约)?\s*([0-9]+(?:\.[0-9]+)?)\s*(立方毫米|立方厘米|立方分米|立方米|立方千米|mm³|mm3|cm³|cm3|dm³|dm3|m³|m3|km³|km3)\s*$/i;
      const volumeRe =
        /^\s*(.+?)\s*(?:容积|的容积|装|能装)?\s*(?:是|有|约)?\s*([0-9]+(?:\.[0-9]+)?)\s*(毫升|升|公升|ml|l|cc)\s*$/i;
      const areaRe =
        /^\s*(.+?)\s*(?:面积|的面积|占地|大小)?\s*(?:是|有|约)?\s*([0-9]+(?:\.[0-9]+)?)\s*(平方毫米|平方厘米|平方分米|平方米|平方千米|平方公里|公顷|亩|mm²|mm2|cm²|cm2|dm²|dm2|m²|m2|km²|km2|ha)\s*$/i;
      const lengthRe =
        /^\s*(.+?)\s*(?:长|高|宽|厚|的长度是|的高度是|是|有)?\s*([0-9]+(?:\.[0-9]+)?)\s*(毫米|厘米|分米|米|千米|公里|mm|cm|dm|km|m)\s*$/i;
      const m =
        text.match(cubicRe) ||
        text.match(areaRe) ||
        text.match(volumeRe) ||
        text.match(weightRe) ||
        text.match(timeRe) ||
        text.match(lengthRe);
      if (m) {
        if (!object) object = m[1].trim();
        if (!Number.isFinite(value)) value = parseFloat(m[2]);
        if (!unit) {
          const raw = m[3];
          const u = raw.toLowerCase();
          const cubicMap: Record<string, string> = {
            "mm³": "立方毫米",
            "mm3": "立方毫米",
            "cm³": "立方厘米",
            "cm3": "立方厘米",
            "dm³": "立方分米",
            "dm3": "立方分米",
            "m³": "立方米",
            "m3": "立方米",
            "km³": "立方千米",
            "km3": "立方千米",
          };
          const volumeMap: Record<string, string> = {
            ml: "毫升",
            l: "升",
            cc: "毫升",
            公升: "升",
          };
          const areaMap: Record<string, string> = {
            "mm²": "平方毫米",
            "mm2": "平方毫米",
            "cm²": "平方厘米",
            "cm2": "平方厘米",
            "dm²": "平方分米",
            "dm2": "平方分米",
            "m²": "平方米",
            "m2": "平方米",
            "km²": "平方千米",
            "km2": "平方千米",
            "ha": "公顷",
            "平方公里": "平方千米",
          };
          const lengthMap: Record<string, string> = {
            mm: "毫米",
            cm: "厘米",
            dm: "分米",
            km: "千米",
            m: "米",
            公里: "千米",
          };
          const weightMap: Record<string, string> = {
            mg: "毫克",
            g: "克",
            kg: "千克",
            t: "吨",
            公克: "克",
            公斤: "千克",
            公吨: "吨",
          };
          const timeMap: Record<string, string> = {
            ms: "毫秒",
            s: "秒",
            min: "分钟",
            h: "小时",
            分: "分钟",
            时: "小时",
            日: "天",
            星期: "周",
            月: "个月",
          };
          unit =
            cubicMap[u] ??
            areaMap[u] ??
            volumeMap[u] ??
            weightMap[u] ??
            timeMap[u] ??
            lengthMap[u] ??
            raw;
        }
      }
    }
    const excludeRefs = Array.isArray(body.exclude_refs)
      ? body.exclude_refs.filter((s): s is string => typeof s === "string")
      : [];

    // 至少要有 text 或 (object+value+unit) 之一
    if (!text && (!object || !Number.isFinite(value) || !unit)) {
      return Response.json(
        { error: "请提供 text 或 (object + value + unit)" },
        { status: 400 },
      );
    }

    // 优先走 catalog 协议（Phase 1：仅长度维度）。
    // 命中即返回；任何失败（候选不足 / LLM 错 / 校验都不过）都安静回退到旧 references.ts 流程。
    if (dimension === "length") {
      try {
        const catalogResp = await tryCatalogFlowForLength({
          request,
          text,
          object,
          value,
          unit,
          excludeRefs,
          detectedAxis,
        });
        if (catalogResp) return Response.json(catalogResp);
      } catch (e) {
        console.warn("[parse] catalog 流异常，回退 references.ts：", e);
      }
    }

    // 时间维度：自由生成协议（Phase 2）。
    // 时间可视化是翻页日历不需要图，AI 完全自由生成 ref 标签 + 秒数。
    // 失败时回退到下面的标准 references.ts 流程。
    if (dimension === "time") {
      try {
        const timeResp = await tryFreeFormTimeFlow({
          text,
          object,
          value,
          unit,
          excludeRefs,
        });
        if (timeResp) return Response.json(timeResp);
      } catch (e) {
        console.warn("[parse] time 自由生成异常，回退 references.ts：", e);
      }
    }

    // 调 DeepSeek（旧路径，作为兜底 + 非长度维度）
    try {
      const parsed = await chatJSON<ParsedInput>(
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserPrompt(
              text,
              object,
              value,
              unit,
              dimension,
              excludeRefs,
              detectedAxis,
            ),
          },
        ],
        { temperature: 0.6, timeoutMs: 12_000 },
      );

      // 校验 + resolve refs
      if (!Array.isArray(parsed.comparison_refs)) {
        throw new Error("comparison_refs 字段缺失或不是数组");
      }
      // 1) 滤掉 AI 偷懒返回的 exclude 列表里的 id
      // 2) 滤掉超出 [target/3, target×3] 的（小学生理解不了对数尺度对比）
      // 3) resolve 成 ReferenceObject
      const excludeSet = new Set(excludeRefs);
      const valueInSi =
        Number.isFinite(parsed.value_in_si)
          ? parsed.value_in_si
          : (toSI(value, unit, dimension) ?? value);
      const { RATIO_MIN, RATIO_MAX } = ratioBoundsFor(dimension);
      const inRange = (size: number) => {
        if (!Number.isFinite(valueInSi) || valueInSi <= 0 || size <= 0) {
          return true;
        }
        const r = size / valueInSi;
        return r >= RATIO_MIN && r <= RATIO_MAX;
      };
      // 轴向匹配：detectedAxis 锁定时，只接受同轴或 "either" 的参考物
      const axisOk = (refAxis: string | undefined) => {
        const a = refAxis ?? "horizontal";
        return a === detectedAxis || a === "either";
      };
      // 同名物体过滤：避免 "椰子树高 25 米" 拿椰子树自己当参考物
      const targetName = (parsed.object || object || "").trim();
      const isSameAsTarget = (refLabel: string) => {
        if (!targetName) return false;
        const a = targetName;
        const b = refLabel.trim();
        return a === b || a.includes(b) || b.includes(a);
      };
      const resolved = parsed.comparison_refs
        .filter((id) => !excludeSet.has(id))
        .map((id) => REFERENCE_MAP[id])
        .filter(
          (r): r is ReferenceObject =>
            Boolean(r) &&
            inRange(r.size) &&
            axisOk(r.axis) &&
            !isSameAsTarget(r.label),
        );

      // 如果 AI 选的没一个在 3 倍范围内 + 同轴 → fallback
      if (resolved.length === 0) {
        return Response.json(
          await buildFallback(
            text,
            object,
            value,
            unit,
            dimension,
            excludeRefs,
            detectedAxis,
          ),
        );
      }

      // 不足 N 个 → 先按"同轴 + 3 倍范围内 + 距离最近"补齐；
      // 如果池子确实不够，再补最近的同轴项。
      // N 由 refCountFor 决定：weight=1（天平只对一个），其它=2（小 + 大）。
      const targetRefCount = refCountFor(dimension);
      if (resolved.length < targetRefCount) {
        const usedIds = new Set([
          ...excludeRefs,
          ...resolved.map((r) => r.id),
        ]);
        const baseCandidates = getReferencesForAI(dimension).filter(
            (r) =>
              !usedIds.has(r.id) &&
              r.size > 0 &&
              !isSameAsTarget(r.label) &&
              axisOk(r.axis),
          );
        const candidates = baseCandidates
          .filter((r) => inRange(r.size))
          .map((r) => ({
            id: r.id,
            distance: Math.abs(Math.log(valueInSi / r.size)),
          }))
          .sort((a, b) => a.distance - b.distance);
        const relaxedCandidates = baseCandidates
          .filter((r) => !candidates.some((c) => c.id === r.id))
          .map((r) => ({
            id: r.id,
            distance: Math.abs(Math.log(valueInSi / r.size)),
          }))
          .sort((a, b) => a.distance - b.distance);
        for (const candidate of [...candidates, ...relaxedCandidates]) {
          const pick = REFERENCE_MAP[candidate.id];
          if (!pick) continue;
          resolved.push(pick);
          usedIds.add(pick.id);
          if (resolved.length >= targetRefCount) break;
        }
      }

      // ✨ 用 iconRegistry 给目标物找图标。
      //    快路径：先 pickIcon 同步查 openmoji/game-icons/mdi 库（毫秒级）。
      //    库命中 → 直接用；没命中但 AI 给了合法的 target_icon → 用 AI 的；
      //    都没有 + sketch fallback 启用 → 才走 /api/ai/sketch 慢路径（3-15s）。
      //    通过 PARSE_SKETCH_FALLBACK=0 可禁用 sketch 慢路径。
      const enableSketchFallback = process.env.PARSE_SKETCH_FALLBACK !== "0";
      const targetQuery = parsed.object || object;
      const fastPick = pickIcon(targetQuery);
      const aiSuggested = normalizeTargetIcon(parsed.target_icon);
      let targetIconViaRegistry: {
        id: string | null;
        source: "library" | "generated" | "miss";
      };
      if (fastPick.id) {
        targetIconViaRegistry = { id: fastPick.id, source: "library" };
      } else if (aiSuggested) {
        // AI 自报的 fluent-emoji ID 已通过白名单，直接信任，省下 30s sketch 路径
        targetIconViaRegistry = { id: aiSuggested, source: "library" };
      } else if (enableSketchFallback) {
        targetIconViaRegistry = await pickIconWithSketchFallback(targetQuery, {
          baseUrl: new URL(request.url).origin,
        });
      } else {
        targetIconViaRegistry = { id: null, source: "miss" };
      }

      // 给每个 resolved ref 也查一遍图标（基于 ref.label 中文名）
      // 视觉解析顺序：catalog（已烤 PNG）→ visualAssets 兜底
      // 这能保证如 "苹果" 这类同时存在 catalog `apple` 和 ref `apple_weight` 时，
      // 优先用干净的 catalog PNG，而不是维度后缀 ID。
      const refIcons: Record<string, string> = {};
      const refVisuals: Record<string, ResolvedVisual> = {};
      for (const ref of resolved) {
        const r = pickIcon(ref.label);
        if (r.id) refIcons[ref.id] = r.id;
        const catHit = await findCatalogEntryByName(ref.label);
        refVisuals[ref.id] = catHit
          ? {
              assetId: catHit.id,
              label: ref.label,
              iconId: `pixel-png:${catHit.id}`,
              source: "asset",
            }
          : resolveVisualForReference(ref);
      }
      // 目标 visual 同样 catalog 优先
      const targetCatHit = await findCatalogEntryByName(targetName);
      const targetVisualResolved: ResolvedVisual = targetCatHit
        ? {
            assetId: targetCatHit.id,
            label: targetCatHit.label,
            iconId: `pixel-png:${targetCatHit.id}`,
            source: "asset",
          }
        : resolveVisualForTarget(targetName);

      // ⚠️ 严守"用户输入优先"——AI 哪怕觉得不合理也不能擅自改。
      //    只有用户没给（value=NaN / unit=""）时才用 AI 的值。
      const userGaveValue = Number.isFinite(value);
      const userGaveUnit = !!unit;
      const finalValue = userGaveValue
        ? value
        : Number.isFinite(parsed.value)
          ? parsed.value
          : NaN;
      const finalUnit = userGaveUnit ? unit : parsed.unit ?? "";
      const finalValueInSi =
        userGaveValue && userGaveUnit
          ? (toSI(finalValue, finalUnit, dimension) ?? finalValue)
          : Number.isFinite(parsed.value_in_si)
            ? parsed.value_in_si
            : (toSI(finalValue, finalUnit, dimension) ?? finalValue);

      const response: ParseResponse = {
        ...parsed,
        // 强制确保字段类型
        dimension: parsed.dimension ?? dimension,
        value: finalValue,
        unit: finalUnit,
        value_in_si: finalValueInSi,
        // 服务端嗅探的 axis 是权威——AI 偶尔会忽略指令
        target_axis: detectedAxis,
        // 1) registry 命中 → 用；2) 否则尝试 AI 给的（兜底头像替换）；3) 都没 → undefined
        target_icon:
          targetIconViaRegistry.id ??
          normalizeTargetIcon(parsed.target_icon),
        resolved_refs: resolved,
        target_visual: targetVisualResolved,
        ref_visuals: refVisuals,
        ref_icons: refIcons,
        source: "ai",
      };
      return Response.json(response);
    } catch (aiErr) {
      // AI 失败 → fallback，但仍返回 200，让前端可用
      console.warn(
        "[/api/ai/parse] AI 失败，使用 fallback:",
        aiErr instanceof DeepSeekError ? aiErr.message : String(aiErr),
      );
      return Response.json(
        await buildFallback(
          text,
          object,
          value,
          unit,
          dimension,
          excludeRefs,
          detectedAxis,
        ),
      );
    }
  } catch (e) {
    return Response.json(
      { error: "服务器错误", detail: String(e) },
      { status: 500 },
    );
  }
}
