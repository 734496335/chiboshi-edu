/**
 * 首页 — 高保真还原设计稿
 *
 * 整体气质：refined + 童趣，不再 collage / chaotic。
 *   ‑ Hero 左侧：问候 pill → 主标题（多色高亮）→ 副标题
 *   ‑ Hero 右侧：尺博士视频，嵌入软椭圆背景，左上方挂"我是尺博士"气泡
 *   ‑ 中部：三张同高同款卡，序号 01/02/03 + IP 角色破框 + 大 CTA 按钮
 *   ‑ 底部：奶油色 tip 条
 *
 * 设计语言：
 *   ‑ 卡片"无重描边"，仅靠 soft drop-shadow 撑起体积感
 *   ‑ 三色主题 #FF9F43 / #2EC4B6 / #B57BFF 各自驱动一张卡
 *   ‑ IP 图片从卡内椭圆 tint 块"破框"探出顶端，增强动势
 *
 * 所有装饰均 aria-hidden。
 */
import Link from "next/link";
import FooterSettings from "@/components/FooterSettings";
import { resolveAsset } from "@/lib/utils";

const DEFAULT_DIM = "length";

// ─────────────────────────────────────────────────────────────
// 模式数据
// ─────────────────────────────────────────────────────────────
interface ModeCard {
  href: string | null;
  /** 角色 PNG（来自 /public） */
  image: string;
  title: string;
  blurb: string;
  /** CTA 主按钮文字 */
  cta: string;
  /** CTA 右侧 icon —— "arrow" 即 → 箭头；"lock" 即 🔒（未开放） */
  ctaIcon: "arrow" | "lock";
  /** 主题色：用于标题、序号、CTA */
  tone: string;
  /** 卡背 tint（很浅，#fff 上加一抹颜色） */
  toneBg: string;
  /** IP 背后的椭圆 tint 颜色（中等饱和度） */
  ovalBg: string;
}

const MODES: ModeCard[] = [
  {
    href: `/play/${DEFAULT_DIM}/sandbox`,
    image: "/ip2.png",
    title: "Measure & Compare",
    blurb: "Choose an object and a size.\nSee how they compare.",
    cta: "Explore",
    ctaIcon: "arrow",
    tone: "#FF9F43",
    toneBg: "#FFF6EA",
    ovalBg: "#FFE4C2",
  },
  {
    href: `/play/${DEFAULT_DIM}/dictionary`,
    image: "/ip3.png",
    title: "Reference Library",
    blurb: "How long is one metre?\nFind an everyday reference.",
    cta: "Look it up",
    ctaIcon: "arrow",
    tone: "#2EC4B6",
    toneBg: "#EAF8F5",
    ovalBg: "#C7ECE5",
  },
  // 「万物造造看」—— 字面与"万物量量看"对仗（量↔造），引导孩子从"看见"
  // 走到"创造"。链接指向 sandbox 的创造模式（?mode=create），由 SandboxStage
  // 内部读 query 决定要不要预聚焦输入框 / 启用 AI 生成提示。
  {
    href: `/dev/icons`,
    image: "/ip6.png",
    title: "Creation Studio",
    blurb: "Imagine an unusual object.\nTry the optional AI workshop.",
    cta: "Create",
    ctaIcon: "arrow",
    tone: "#B57BFF",
    toneBg: "#F4EEFF",
    ovalBg: "#E0D0FF",
  },
  // —— 闯关大冒险（已隐藏，等关卡内容做好再放回） ——
  // {
  //   href: null,
  //   image: "/ip4.png",
  //   title: "闯关大冒险",
  //   blurb: "尺博士给你出题\n估得准就能升级！",
  //   cta: "一起战斗吧",
  //   ctaIcon: "lock",
  //   tone: "#B57BFF",
  //   toneBg: "#F4EEFF",
  //   ovalBg: "#E0D0FF",
  // },
];

// ─────────────────────────────────────────────────────────────
// 装饰：小星星
// ─────────────────────────────────────────────────────────────
function Sparkle({
  x,
  y,
  size = 18,
  color = "#FFC93C",
  rotate = 0,
}: {
  x: string;
  y: string;
  size?: number;
  color?: string;
  rotate?: number;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `rotate(${rotate}deg)`,
        pointerEvents: "none",
        opacity: 0.85,
      }}
    >
      <path
        d="M12 2 L13.6 9.8 L21.5 11.4 L13.6 13 L12 20.8 L10.4 13 L2.5 11.4 L10.4 9.8 Z"
        fill={color}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero 右侧：尺博士视频 + 气泡
// ─────────────────────────────────────────────────────────────
function OwlHeroVideo() {
  return (
    <div
      aria-hidden
      className="relative w-full"
      style={{ aspectRatio: "1 / 0.9" }}
    >
      {/* 椭圆 tint 软背景 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 95% 90%, #FFE7C2 0%, #FFF5E0 55%, transparent 80%)",
          borderRadius: "50% 50% 48% 52% / 52% 48% 52% 48%",
        }}
      />
      {/* 视频本体 */}
      <div
        className="absolute"
        style={{
          // inset 四个值：上 / 右 / 下 / 左 各往内收多少
          // 上/下变小（甚至变负）→ 视频框变高 → 露出头和脚
          // 左/右不动 → 横向尺寸不变
          inset: "-8% 4% -8% 4%",
          borderRadius: "52% 38% 50% 90% / 90% 52% 98% 50%",
          overflow: "hidden",
          boxShadow:
            "0 30px 60px -24px rgba(224,127,37,0.35), inset 0 4px 0 rgba(255,255,255,0.4)",
        }}
      >
        <video
          src={resolveAsset("/ip1.mp4?v=2")}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            width: "100%",
            height: "108%",
            objectFit: "cover",
            display: "block",
            // 缩小视频里的猫头鹰（外框不变）
            // 调这个数字：0.7 = 缩到 70%；越小猫头鹰越小，边缘会露出 hero 区背景的暖色
            transform: "scale(1)",
            transformOrigin: "center center",
          }}
        />
        <span 
          className="absolute bottom-1 right-2 text-[9px] text-white opacity-80 scale-[0.75] origin-bottom-right pointer-events-none select-none"
          style={{ fontFamily: '"Alibaba PuHuiTi", sans-serif' }}
        >
          AI-generated
        </span>
      </div>
      {/* "我是尺博士"气泡 */}
      <div
        className="absolute font-display"
        style={{
          left: "0%",
          top: "8%",
          background: "#fff",
          color: "#4A3520",
          padding: "8px 18px",
          borderRadius: 22,
          fontSize: "1.2rem",
          fontWeight: 400,
          boxShadow:
            "0 8px 22px -8px rgba(74,53,32,0.25), 0 0 0 1px rgba(74,53,32,0.06)",
        }}
      >
        I’m Dr. Measure
        {/* 气泡小尾巴指向 owl */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -4,
            bottom: -6,
            width: 14,
            height: 14,
            background: "#fff",
            transform: "rotate(35deg)",
            borderRadius: 3,
            boxShadow: "1px 1px 0 rgba(74,53,32,0.05)",
          }}
        />
      </div>
      {/* 散落 sparkle */}
      <Sparkle x="6%" y="2%" size={20} color="#FFC93C" rotate={12} />
      <Sparkle x="44%" y="6%" size={14} color="#FF9F43" rotate={-20} />
      <Sparkle x="92%" y="76%" size={16} color="#FFC93C" rotate={10} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 模式卡（同高同款 × 3）
// ─────────────────────────────────────────────────────────────
function ModeCard({ mode, index = 0 }: { mode: ModeCard; index?: number }) {
  const disabled = !mode.href;

  const inner = (
    <div
      className={`mode-card-base relative h-full flex flex-col ${
        disabled
          ? "transition-transform duration-300"
          : "mode-card-hoverable hover:-translate-y-1"
      }`}
      style={
        {
          background: mode.toneBg,
          borderRadius: 28,
          padding: "20px 22px 22px",
          // boxShadow 不放这里：inline 优先级高于 :hover 类规则，会让 hover 发光失效
          // base shadow 由 .mode-card-base 提供
          // hover 发光由 .mode-card-hoverable:hover 提供
          "--card-tone": mode.tone,
        } as React.CSSProperties
      }
    >
      {/* 主视觉：椭圆 tint + IP 破框 */}
      <div
        className="relative mx-auto"
        aria-hidden
        style={{
          width: "100%",
          height: 200,
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        {/* 椭圆 tint */}
        <div
          className="absolute"
          style={{
            left: "10%",
            right: "10%",
            bottom: 0,
            height: "78%",
            background: mode.ovalBg,
            borderRadius: "50% 50% 46% 54% / 52% 48% 50% 50%",
            opacity: 0.85,
          }}
        />
        {/* IP 浮动 wrapper：用 float-y keyframes 做轻微上下漂浮
            三张卡按 index 错峰，避免节奏齐刷刷不自然 */}
        <div
          className="absolute inset-0"
          style={{
            animation: "float-y 3s ease-in-out infinite",
            animationDelay: `${index * 0.7}s`,
          }}
        >
          {/* IP 图片：撑出 tint 块顶部，制造破框 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAsset(mode.image)}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -54%)",
              height: "120%",
              width: "auto",
              maxWidth: "none",
              filter: "drop-shadow(0 10px 14px rgba(74,53,32,0.22))",
              pointerEvents: "none",
            }}
          />
          <span 
            className="absolute bottom-1 right-[10%] text-[9px] text-white opacity-80 scale-[0.75] origin-bottom-right pointer-events-none select-none"
            style={{ fontFamily: '"Alibaba PuHuiTi", sans-serif' }}
          >
            AI-generated
          </span>
        </div>
      </div>

      {/* 标题 */}
      <div
        className="font-display text-center"
        style={{
          color: mode.tone,
          fontSize: "1.8rem",
          fontWeight: 400,
          letterSpacing: "0.04em",
          marginBottom: 8,
        }}
      >
        {mode.title}
      </div>
      {/* 副标题 */}
      <div
        className="text-center whitespace-pre-line leading-relaxed mb-5"
        style={{
          color: "rgba(74,53,32,0.7)",
          fontSize: "1.2rem",
        }}
      >
        {mode.blurb}
      </div>

      {/* CTA 大按钮（推到底部） */}
      <div className="mt-auto">
        <div
          className="font-display flex items-center justify-center gap-2"
          style={{
            width: "100%",
            height: 52,
            borderRadius: 999,
            background: mode.tone,
            color: "#fff",
            fontSize: "1.6rem",
            fontWeight: 400,
            letterSpacing: "0.06em",
            boxShadow: disabled
              ? "0 8px 18px -10px rgba(74,53,32,0.25)"
              : `0 10px 22px -10px ${mode.tone}99`,
            opacity: disabled ? 0.85 : 1,
          }}
        >
          <span>{mode.cta}</span>
          {mode.ctaIcon === "arrow" ? (
            <ArrowIcon />
          ) : (
            <LockIcon />
          )}
        </div>
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div className="block h-full cursor-not-allowed select-none">
        {inner}
      </div>
    );
  }
  return (
    <Link href={mode.href as string} className="block h-full">
      {inner}
    </Link>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginLeft: 4 }}
    >
      <path
        d="M5 12 H19 M13 6 L19 12 L13 18"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginLeft: 4 }}
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2.2"
        stroke="#fff"
        strokeWidth={2}
      />
      <path
        d="M8 10 V7.5 a4 4 0 0 1 8 0 V10"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 底部 tip 条
// ─────────────────────────────────────────────────────────────
function TipBanner() {
  return (
    <div
      className="relative flex items-center justify-between"
      style={{
        marginTop: 36,
        background: "#FDF1D5",
        borderRadius: 999,
        padding: "14px 28px",
        boxShadow:
          "0 14px 32px -16px rgba(74,53,32,0.18), inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      <div className="flex items-center gap-3">
        <StarBadge />
        <span
          className="font-display"
          style={{
            color: "#4A3520",
            fontSize: "1.2rem",
            fontWeight: 400,
            letterSpacing: "0.03em",
          }}
        >
          Try an estimate, compare it, then check with a real measurement.
        </span>
      </div>
      <div className="relative flex items-center gap-3 pr-2">
        <Sparkle x="-22px" y="-10px" size={12} color="#FFC93C" rotate={20} />
        <Sparkle x="-6px" y="22px" size={10} color="#FF9F43" rotate={-15} />
        <span
          aria-hidden
          style={{
            fontSize: 30,
            lineHeight: 1,
            filter: "drop-shadow(0 4px 6px rgba(74,53,32,0.18))",
          }}
        >
          📏
        </span>
      </div>
    </div>
  );
}

function StarBadge() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        background: "#FFE08A",
        boxShadow:
          "0 6px 14px -6px rgba(224,178,37,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B">
        <path d="M12 3.2 L14.4 9.4 L21 10 L16 14.4 L17.6 21 L12 17.5 L6.4 21 L8 14.4 L3 10 L9.6 9.4 Z" />
      </svg>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 顶部"你好呀~" pill
// ─────────────────────────────────────────────────────────────
function HelloPill() {
  return (
    <div
      className="font-display inline-flex items-center gap-2"
      style={{
        background: "#fff",
        color: "#4A3520",
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: "1.2rem",
        fontWeight: 400,
        boxShadow:
          "0 8px 22px -10px rgba(74,53,32,0.2), 0 0 0 1px rgba(74,53,32,0.05)",
      }}
    >
      <span aria-hidden style={{ fontSize: "1.1rem" }}>
        👋
      </span>
      <span>Hello, explorer!</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <main
      lang="en"
      className="relative min-h-screen overflow-x-clip"
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 80% 0%, #FFEAC8 0%, transparent 65%)," +
          "var(--background)",
      }}
    >
      {/* 全局零散星点（控制密度，不过装饰） */}
      <Sparkle x="46%" y="6%" size={16} color="#FFC93C" rotate={15} />
      <Sparkle x="36%" y="50%" size={14} color="#B57BFF" rotate={-10} />
      <Sparkle x="92%" y="58%" size={14} color="#2EC4B6" rotate={20} />
      <Sparkle x="6%" y="68%" size={18} color="#FF9F43" rotate={-15} />

      <div className="relative max-w-[1180px] mx-auto px-5 md:px-10 py-8 md:py-12">
        {/* ━━━━━━━━━━ Hero ━━━━━━━━━━ */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mb-10 md:mb-14">
          <div className="md:col-span-7">
            <div className="mb-5">
              <HelloPill />
            </div>
            <h1
              className="font-display leading-[0.95] mb-5"
              style={{
                fontSize: "clamp(2.5rem, 6.2vw, 4.6rem)",
                fontWeight: 400,
                color: "var(--foreground)",
                letterSpacing: "0.04em",
              }}
            >
              What will you
              <br />
              <span style={{ color: "#FF9F43" }}>measure </span>
              <span style={{ color: "#2EC4B6" }}>today</span>
              <span style={{ color: "#B57BFF" }}>?</span>
            </h1>
            <p
              className="max-w-md"
              style={{
                color: "rgba(74,53,32,0.7)",
                fontSize: "clamp(0.95rem, 1.3vw, 1.05rem)",
                lineHeight: 1.55,
              }}
            >
              Chiboshi — Measurement Playground. Explore everyday quantities with Dr. Measure, one comparison at a time.
            </p>
          </div>
          <div className="md:col-span-5">
            <OwlHeroVideo />
          </div>
        </section>

        {/* ━━━━━━━━━━ 三张模式卡（等高等款） ━━━━━━━━━━ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {MODES.map((mode, i) => (
            <ModeCard key={mode.title} mode={mode} index={i} />
          ))}
        </section>

        {/* ━━━━━━━━━━ Tip 条 ━━━━━━━━━━ */}
        <TipBanner />

        <section className="mt-8 text-center text-sm leading-relaxed text-[color:var(--foreground)]/70" aria-label="About this project">
          <p>
            The classroom activities currently use Simplified Chinese. Start with the{" "}
            <a className="underline underline-offset-4" href="https://github.com/734496335/chiboshi-edu/blob/main/docs/LEARNING_GUIDE.md">English learning guide</a>.
          </p>
          <p className="mt-2">
            An educational source project independently maintained by{" "}
            <a className="underline underline-offset-4" href="https://github.com/734496335">734496335</a>.
            {" "}<a className="underline underline-offset-4" href="https://github.com/734496335/chiboshi-edu">Source &amp; contributions</a>
          </p>
        </section>

        <FooterSettings />
      </div>
    </main>
  );
}
