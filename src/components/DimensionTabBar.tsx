/**
 * DimensionTabBar — 模式内的"维度切换"顶栏
 *
 * 信息架构 v2：用户先选模式（sandbox / dictionary / ...），进来后在顶栏
 * 切换"长度/面积/容积/体积/重量/时间"。每个 tab 是一个 Link，导航到
 *   /play/<dim>/<mode>
 *
 * 视觉：
 *   - 中央大字"今天我们一起来量量【长度】吧～"，配尺博士头像
 *   - 下方一排卡通 tab，激活态用维度色描边 + 抬升
 */
import Link from "next/link";
import { DIMENSIONS, type DimensionKey } from "@/lib/dimensions";

// —— 维度展示顺序（教研约定，与 src/lib/dimensions.ts 里的数据顺序解耦）
// 长度 → 体积 → 面积 → 容积 → 重量 → 时间
const DISPLAY_ORDER: DimensionKey[] = [
  "length",
  "area",
  "cubic",  
  "volume",
  "weight",
  "time",
];

interface Props {
  /** 当前激活的维度 */
  active: DimensionKey;
  /** 模式 slug：sandbox | dictionary | challenge ... 决定 tab 链接尾巴 */
  mode: string;
  /** 顶部主标题模板，{label} 会被替换为当前维度名。默认"今天我们一起来量量__吧～" */
  titleTemplate?: string;
  /** 模式徽章文案（顶部居中标题），可选；tone 用于和首页同款配色 */
  modeBadge?: { label: string; emoji?: string; tone?: string };
}

export function DimensionTabBar({
  active,
  mode,
  titleTemplate = "今天我们一起来量量{label}吧～",
  modeBadge,
}: Props) {
  const activeDim = DIMENSIONS.find((d) => d.key === active);
  // 把 titleTemplate 用 {label} 切成"前缀…后缀"两段——chips 会插在中间，
  // 整体读起来就是一句话："今天我们一起来学学 [📏长度] 吧～"。
  const [titlePrefix, titleSuffix = ""] = titleTemplate.split("{label}");
  const orderedDims = DISPLAY_ORDER.map((k) =>
    DIMENSIONS.find((d) => d.key === k),
  ).filter((d): d is (typeof DIMENSIONS)[number] => Boolean(d));

  return (
    <header className="mx-auto w-full max-w-[1600px] px-6 md:px-8 pt-5 pb-2">
      {/* —— 顶行：🏠 返回 + 模式徽章；标题不再放这里，因为标题内容 *由下面 tab 决定*，
              先标题后 tab 在认知顺序上是反的（先看到结果、再看到原因），
              所以把"今天我们一起来量量 X 吧～"挪到 tab 下方，作为 tab 选择后的"宣言"。 */}
      {/* 顶行：[← 返回] ……… [🦉 万物量量看 居中] ……… 占位
              用三栏 grid：左占位、中居中、右占位等宽，保证模式徽章真正水平居中
              （flex+justify-between 会因左按钮宽度不同而漂） */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <div className="justify-self-start">
          <Link
            href="/"
            className="cartoon-btn font-display inline-flex items-center gap-1.5 bg-white"
            aria-label="返回首页"
            style={{
              fontSize: "0.95rem",
              padding: "8px 16px",
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            {/* 朴素 chevron-left SVG，跟着 currentColor 走 */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>返回</span>
          </Link>
        </div>
        {modeBadge && (
          // 纯文字标题，不再是黄底胶囊——左侧返回按钮已经够"按钮感"，
          // 中间放一个相同视觉权重的胶囊会让顶部"两个按钮夹一个标题"那种拥挤感。
          // 改成纯文字后，这里就是页面的"模式名"，文字本身够大就够。
          <span
            className="font-display whitespace-nowrap justify-self-center"
            style={{
              // 与首页同款标题：Maoken Lite 单字重，靠"字号大 + 字距"撑场面，
              // 字重必须 400——加粗会让笔画黏成一团（Lite 体没真正粗体字形，
              // 浏览器伪粗会把字糊一起）。
              fontSize: "1.8rem",
              color: modeBadge.tone ?? "var(--foreground)",
              fontWeight: 400,
              letterSpacing: "0.06em",
            }}
          >
            {modeBadge.emoji ? `${modeBadge.emoji} ` : ""}
            {modeBadge.label}
          </span>
        )}
        <div />
      </div>

      {/* —— 标题 = 一句话填空：
              「今天我们一起来学学 [📏长度] [📦体积] [📐面积] [🥤容积] [⚖️重量] [⏰时间] 吧～」
              chips 是句子里的"备选词"：激活的那个用维度色加亮，其余浅化但仍可点。
              hover 时未激活的 chip 立刻"亮起来"——像在句子里试穿那个词。 */}
      <h1
        className="font-display flex flex-wrap items-center gap-x-3 gap-y-2 m-0"
        style={{
          fontSize: "1.7rem",
          lineHeight: 1.3,
          fontWeight: 400,
          color: "var(--foreground)",
        }}
      >
        {titlePrefix && (
          <span className="select-none">{titlePrefix}</span>
        )}
        {orderedDims.map((d) => {
          const isActive = d.key === active;
          const isAvailable = d.available;
          const href = `/play/${d.key}/${mode}`;
          const chip = (
            <span
              className={`dim-chip inline-flex items-center gap-1.5 font-display select-none transition-all ${
                isActive
                  ? "is-active"
                  : isAvailable
                    ? "is-idle"
                    : "is-locked"
              }`}
              style={{
                // chips 字号 ≈ 前缀文字大小，看上去既是"句子里的词"又有按钮的可点性。
                fontSize: "1.5rem",
                padding: "10px 20px",
                borderRadius: 16,
                background: isActive
                  ? `color-mix(in srgb, ${d.color} 16%, #fff)`
                  : "#fff",
                border: `2px solid ${
                  isActive ? d.color : "rgba(74,53,32,0.18)"
                }`,
                borderBottomWidth: isActive ? 4 : 3,
                color: isActive ? d.color : "var(--ink-soft)",
                fontWeight: isActive ? 300 : 300,
                opacity: isActive ? 1 : 0.7,
                // 用 CSS 变量把 hover 颜色透传给 :hover 伪类（见 globals.css）。
                ["--chip-color" as string]: d.color,
              }}
            >
              <span aria-hidden>{d.emoji}</span>
              <span>{d.label}</span>
            </span>
          );
          if (!isAvailable) {
            return <span key={d.key}>{chip}</span>;
          }
          return (
            <Link
              key={d.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className="no-underline"
            >
              {chip}
            </Link>
          );
        })}
        {titleSuffix && (
          <span className="select-none">{titleSuffix}</span>
        )}
      </h1>
    </header>
  );
}
