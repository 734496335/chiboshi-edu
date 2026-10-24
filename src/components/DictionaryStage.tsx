"use client";
/**
 * 量感字典舞台（客户端）
 *
 * 三大区块：
 *   ① 顶部搜索栏：输入任意物品名，命中即弹出结果卡片
 *   ② 左侧"刻度尺"：纵向 7 个刻度（1mm → 1km），scrollspy + 锚点跳转
 *   ③ 主体卡片网格：每刻度 3 张精选卡（图 + 名 + 尺寸 + 记忆钩子）
 *
 * 儿童教育产品设计要点：
 *   - 每张卡只承担 **1 个** 记忆锚点，不堆百科
 *   - 颜色按刻度渐变，建立"由小到大"的视觉节奏
 *   - 卡片可点击 → 跳转沙盒预填，形成"看一看 → 量一量"闭环
 */
import * as React from "react";
import Link from "next/link";
import { resolveAsset } from "@/lib/utils";
import {
  LENGTH_DICTIONARY,
  getDictionaryForDimension,
  type DictItem,
  type DictScale,
} from "@/lib/dictionary";
import type { DimensionKey } from "@/lib/dimensions";
import { LoadingDots } from "@/components/LoadingDots";

// ─────────────────────────────────────────────────────────────
// SectionHeader —— 全局通用的"分区眉标"
//
// 设计意图（信息架构外显）：
//   一个页面有多个功能块时，最忌讳"等高等大并列"——用户分不出哪个是工具哪个是内容。
//   方案：每块内容上方放一组 [kicker pill + subtitle]：
//     - kicker pill：彩色背景小胶囊，2-6 字，告诉用户"这块的功能定位"
//     - subtitle：小灰字一行，告诉用户"这块怎么用 / 有什么"
//   不同 section 的 kicker 用不同主题色，让相隔的内容获得"视觉分组身份"。
// ─────────────────────────────────────────────────────────────
function SectionHeader({
  kicker,
  kickerColor,
  kickerBg,
  kickerIcon,
  subtitle,
}: {
  kicker: string;
  kickerColor: string;
  kickerBg: string;
  kickerIcon?: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginBottom: 14,
        flexWrap: "wrap",
      }}
    >
      <span
        className="font-display"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: kickerBg,
          color: kickerColor,
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 14,
          letterSpacing: "0.06em",
          fontWeight: 700,
          border: `1.5px solid ${kickerColor}33`,
        }}
      >
        {kickerIcon && (
          <span aria-hidden style={{ fontSize: 14 }}>
            {kickerIcon}
          </span>
        )}
        {kicker}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: 14,
            color: "var(--foreground)",
            opacity: 0.55,
            letterSpacing: "0.02em",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 字典卡 —— 单个物品
// ─────────────────────────────────────────────────────────────
function ItemCard({
  item,
  accent,
  variant = "scale",
}: {
  item: DictItem;
  accent: string;
  /** scale = 字典浏览卡（带 hook）；search = 搜索结果卡（无 hook，更紧凑）；ask = 问一问结果卡 */
  variant?: "scale" | "search" | "ask";
}) {
  const [imgOk, setImgOk] = React.useState(true);
  return (
    <div
      className="dict-card group"
      style={{
        background: "#fff",
        borderRadius: 22,
        border: "2px solid #EFE3C2",
        boxShadow: "0 2px 0 rgba(180, 155, 95, 0.18)",
        padding: variant === "search" ? "16px" : "16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "transform 180ms ease, box-shadow 180ms ease",
        cursor: "default",
      }}
    >
      {/* 图区 —— 白底大图，让像素画呼吸 */}
      <div
        style={{
          aspectRatio: "1 / 1",
          background:
            "linear-gradient(180deg, #FFFCF4 0%, #FFF5E0 100%)",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {imgOk ? (
          <>
            <img
              src={resolveAsset(`/icons/pixel/${item.catalogId}.png`)}
              alt={item.label ?? item.catalogId}
              style={{
                width: "78%",
                height: "78%",
                objectFit: "contain",
                imageRendering: "pixelated",
              }}
              onError={() => setImgOk(false)}
            />
            <span 
              className="absolute bottom-1 right-2 text-[9px] text-white opacity-80 scale-[0.75] origin-bottom-right pointer-events-none select-none"
              style={{ fontFamily: '"Alibaba PuHuiTi", sans-serif' }}
            >
              AI生成
            </span>
          </>
        ) : (
          <span
            aria-hidden
            style={{
              fontSize: 56,
              opacity: 0.4,
            }}
          >
            ❓
          </span>
        )}
      </div>

      {/* 文本区 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          className="font-display"
          style={{
            fontSize: variant === "search" ? 20 : 20,
            color: "var(--foreground)",
            lineHeight: 1.2,
            letterSpacing: "0.02em",
          }}
        >
          {item.label || item.catalogId}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: accent,
            letterSpacing: "0.02em",
          }}
        >
          {item.sizeText}
        </div>
      </div>

      {/* 记忆钩子（仅 scale 视图）—— 黄色填充 pill，💡 起头 */}
      {variant === "scale" && (
        <div
          style={{
            background: "#FFF7DA",
            border: "1.5px solid #F2E1A8",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 13,
            lineHeight: 1.45,
            color: "#6B5A3C",
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 13,
              lineHeight: 1.45,
              flexShrink: 0,
            }}
          >
            💡
          </span>
          <span>{item.hook}</span>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 刻度区块
// ─────────────────────────────────────────────────────────────
function ScaleSection({
  scale,
}: {
  scale: DictScale;
}) {
  return (
    <section
      id={`scale-${scale.id}`}
      style={{ scrollMarginTop: 120 }}
      className="dict-scale-section"
    >
      {/* 区段标题：刻度数字 + 导览语 */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 32,
            color: scale.accent,
            lineHeight: 1,
            letterSpacing: "0.02em",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* 箭头指示当前刻度，比小圆点更具方向感（"翻到这里了"） */}
          <span
            aria-hidden
            style={{
              fontSize: 26,
              lineHeight: 1,
              color: scale.accent,
            }}
          >
            ➜
          </span>
          {scale.title}
        </div>
        <div
          style={{
            fontSize: 16,
            color: "var(--foreground)",
            opacity: 0.7,
          }}
        >
          {scale.tagline}
        </div>
      </div>

      {/* 3 张卡：等宽并排 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
        }}
      >
        {scale.items.map((item) => (
          <ItemCard
            key={item.catalogId}
            item={item}
            accent={scale.accent}
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 左侧刻度尺导航
// ─────────────────────────────────────────────────────────────
function ScaleRail({
  scales,
  activeId,
  dimensionLabel,
}: {
  scales: DictScale[];
  activeId: string;
  dimensionLabel: string;
}) {
  return (
    <nav
      aria-label="刻度导航"
      style={{
        position: "sticky",
        top: 100,
        alignSelf: "start",
        background: "#fff",
        border: "3px solid #E8DCB8",
        borderBottomWidth: 6,
        borderRadius: 24,
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 14,
          color: "var(--foreground)",
          opacity: 0.5,
          letterSpacing: "0.1em",
          padding: "4px 10px 10px",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {dimensionLabel}单位
        <span aria-hidden style={{ fontSize: 11 }}>
          ⌄
        </span>
      </div>

      {/* 中间细线，给"刻度尺"质感 */}
      <div style={{ position: "relative", paddingLeft: 8 }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 16,
            top: 8,
            bottom: 8,
            width: 2,
            background: "#E8DCB8",
            borderRadius: 2,
          }}
        />
        {scales.map((s) => {
          const active = s.id === activeId;
          return (
            <a
              key={s.id}
              href={`#scale-${s.id}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 10px",
                borderRadius: 12,
                textDecoration: "none",
                color: active ? s.accent : "var(--foreground)",
                background: active
                  ? `${s.accent}14`
                  : "transparent",
                fontWeight: active ? 800 : 500,
                fontSize: 15,
                transition: "background 160ms",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: active ? 14 : 10,
                  height: active ? 14 : 10,
                  borderRadius: 999,
                  background: active ? s.accent : "#D7C99B",
                  border: active ? `3px solid #fff` : "none",
                  boxShadow: active
                    ? `0 0 0 2px ${s.accent}`
                    : "none",
                  zIndex: 1,
                  transition: "all 160ms",
                }}
              />
              {s.title}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// 搜索栏 —— 仅用作 "查一查" 的输入入口（不再独立呈现结果）
// ─────────────────────────────────────────────────────────────
function SearchBar({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (q: string) => void;
  onEnter?: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "3px solid #E8DCB8",
        borderBottomWidth: 6,
        borderRadius: 24,
        padding: "8px 12px 8px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span aria-hidden style={{ fontSize: 22 }}>
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder="查一查物品的尺寸，输入任意物品名称"
        aria-label="搜索物品"
        className="font-display"
        style={{
          flex: 1,
          outline: "none",
          border: "none",
          background: "transparent",
          fontSize: 20,
          color: "var(--foreground)",
          padding: "12px 0",
          letterSpacing: "0.02em",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="清空搜索"
          style={{
            border: "none",
            background: "#F2E9CC",
            color: "#6B5A3C",
            width: 32,
            height: 32,
            borderRadius: 999,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 查一查 —— AI 任意物品速查结果（内联，不弹窗）
//
// 使用方式：点击搜索栏右侧"查一查"按钮 → 用搜索框当前输入做 AI 问询
//   → 在搜索栏下方渲染本组件（"尺博士说" + 匹配卡片）
// ─────────────────────────────────────────────────────────────
interface AskResult {
  ok: true;
  label: string;
  description: string;
  sizeText: string;
  sizeM: number;
  catalogId: string | null;
  visualHint: string;
}

function AskResultPanel({
  result,
  onClose,
}: {
  result: AskResult;
  onClose: () => void;
}) {
  const accent = accentForSize(result.sizeM);
  return (
    <div
      style={{
        // 外壳整块改成淡紫色 —— 和"问问尺博士"眉标、紫色查一查按钮共一个色族
        background: "linear-gradient(180deg, #F6F0FF 0%, #EFE6FF 100%)",
        border: "2px solid #E0D0FF",
        borderRadius: 24,
        padding: "20px 22px 22px",
        marginBottom: 28,
        position: "relative",
      }}
    >
      {/* 关闭按钮 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭查一查结果"
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          width: 30,
          height: 30,
          borderRadius: 999,
          border: "1.5px solid #D9C4FF",
          background: "rgba(255,255,255,0.9)",
          color: "#7B45CC",
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px minmax(0, 1fr) 220px",
          gap: 20,
          alignItems: "stretch",
          marginTop: 14,
        }}
      >
        {/* 左：尺博士 IP 形象 —— 放大、低部对齐，有“在场”感 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
          }}
        >
          <img
            src={resolveAsset("/ip3.png")}
            alt="尺博士"
            style={{
              width: "100%",
              maxWidth: 200,
              height: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 6px 0 rgba(123, 69, 204, 0.18))",
            }}
          />
          <span 
            className="absolute bottom-1 right-2 text-[9px] text-white opacity-80 scale-[0.75] origin-bottom-right pointer-events-none select-none"
            style={{ fontFamily: '"Alibaba PuHuiTi", sans-serif' }}
          >
            AI生成
          </span>
        </div>

        {/* 中：白色对话框 —— 用 flex 拉伸，与右侧 ItemCard 同高 */}
        <div
          style={{
            position: "relative",
            paddingLeft: 14,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              // 用百分比 + translateY(-50%)，把尾巴顶点对到对话框垂直中线
              // —— 现在中列被 grid stretch 拉到与右卡同高，固定 px 会脱靶。
              // 想让尾巴更靠上 → 改成 40%，想更靠下 → 改成 60%。
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              borderTop: "12px solid transparent",
              borderBottom: "12px solid transparent",
              borderRight: "14px solid #FFFFFF",
              filter: "drop-shadow(-2px 0 0 #E0D0FF)",
            }}
          />
          <div
            style={{
              background: "#FFFFFF",
              border: "1.5px solid #E0D0FF",
              borderRadius: 18,
              padding: "20px 22px",
              fontSize: 20,
              lineHeight: 1.8,
              color: "#4A3520",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 28,
                marginBottom: 8,
                letterSpacing: "0.02em",
                color: "#7B45CC",
              }}
            >
              {result.label}
            </div>
            {result.description}
          </div>

          {!result.catalogId && (
            <div
              style={{
                fontSize: 12,
                color: "#6B5A3C",
                opacity: 0.6,
                marginTop: 10,
              }}
            >
              （图鉴里暂时没有 {result.visualHint || result.label}{" "}
              的画像，等尺博士补一张）
            </div>
          )}
        </div>

        {/* 右：匹配物品卡 */}
        <ItemCard
          item={{
            catalogId: result.catalogId ?? "",
            label: result.label,
            sizeM: result.sizeM,
            sizeText: result.sizeText,
            hook: "",
          }}
          accent={accent}
          variant="ask"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────────
export function DictionaryStage({
  dimension,
  dimensionLabel,
}: {
  dimension: DimensionKey;
  dimensionLabel: string;
}) {
  const scales = React.useMemo(
    () => getDictionaryForDimension(dimension),
    [dimension],
  );

  const [activeId, setActiveId] = React.useState<string>(
    scales[0]?.id ?? "",
  );
  const [query, setQuery] = React.useState("");
  // 查一查（AI）—— 这些 hook 必须在条件 return 之前声明，保证顺序稳定
  const [askLoading, setAskLoading] = React.useState(false);
  const [askResult, setAskResult] = React.useState<AskResult | null>(null);
  const [askError, setAskError] = React.useState<string | null>(null);

  const runAsk = React.useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed || askLoading) return;
      setAskLoading(true);
      setAskError(null);
      try {
        const res = await fetch(resolveAsset("/api/dict/ask"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: trimmed, dim: dimension }),
        });
        const data = await res.json();
        if (data.ok) {
          setAskResult(data as AskResult);
        } else {
          setAskResult(null);
          setAskError(data.error || "尺博士今天有点累，再试一次吧～");
        }
      } catch (e) {
        setAskResult(null);
        setAskError((e as Error).message || "网络好像断了，再试试");
      } finally {
        setAskLoading(false);
      }
    },
    [dimension, askLoading],
  );

  // scrollspy：观察每个 section 进入视窗的状态
  React.useEffect(() => {
    if (!scales.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // 取距离顶部最近的可见区块
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^scale-/, "");
          setActiveId(id);
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 },
    );
    scales.forEach((s) => {
      const el = document.getElementById(`scale-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [scales]);

  // 维度不支持时给出友好提示
  if (scales.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[1100px] px-6 md:px-8 pt-8 pb-16">
        <div
          style={{
            background: "#fff",
            border: "3px solid #E8DCB8",
            borderBottomWidth: 6,
            borderRadius: 28,
            padding: "60px 40px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>📖</div>
          <h2
            className="font-display"
            style={{
              fontSize: 28,
              color: "var(--foreground)",
              marginBottom: 12,
            }}
          >
            {dimensionLabel}量感字典正在编写中
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "var(--foreground)",
              opacity: 0.7,
              lineHeight: 1.6,
            }}
          >
            目前只上线了"长度"字典 —— 我们正在为
            {dimensionLabel}
            精选合适的锚点物品。
            <br />
            先去
            <Link
              href={`/play/${dimension}/sandbox`}
              style={{
                color: "var(--primary)",
                textDecoration: "underline",
                margin: "0 4px",
              }}
            >
              万物量量看
            </Link>
            试试吧！
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1400px] px-6 md:px-8 pt-2 pb-16">
      {/* ════════════════════════════════════════════════════════
          区块 ①  问问尺博士（AI 工具区）
          —— 用紫色 eyebrow 标签明确告诉用户："这是工具区"
          —— 与下方"翻字典"用色彩+留白强行视觉分隔
          ════════════════════════════════════════════════════════ */}
      <SectionHeader
        kicker="问问尺博士"
        kickerColor="#7B45CC"
        kickerBg="#F4EEFF"
        kickerIcon="✨"
        subtitle="输入任意物品，AI 告诉你它有多大"
      />

      {/* 顶部：搜索栏（左，占满） + 查一查按钮（右） */}
      <div
        style={{
          marginBottom: 28,
          display: "flex",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            onEnter={() => runAsk(query)}
          />
        </div>
        <button
          type="button"
          onClick={() => runAsk(query)}
          disabled={!query.trim() || askLoading}
          className="font-display"
          aria-label="查一查"
          style={{
            background:
              query.trim() && !askLoading
                ? "linear-gradient(180deg, #B57BFF 0%, #9159E0 100%)"
                : "#E5D9B6",
            color: query.trim() && !askLoading ? "#fff" : "#A89A78",
            border: `2px solid ${
              query.trim() && !askLoading ? "#7B45CC" : "#C9BC95"
            }`,
            borderRadius: 24,
            padding: "0 24px",
            fontSize: 22,
            letterSpacing: "0.08em",
            cursor: askLoading
              ? "wait"
              : query.trim()
                ? "pointer"
                : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
            transition: "transform 120ms",
            boxShadow:
              query.trim() && !askLoading
                ? "0 4px 0 rgba(123, 69, 204, 0.25)"
                : "none",
            minWidth: 170,
            justifyContent: "center",
          }}
        >
          {askLoading ? (
            <>
              查找中
              <LoadingDots size={22} color="#fff" />
            </>
          ) : (
            <>
              <span aria-hidden style={{ fontSize: 18 }}>🪄</span>
              <span>查 一 查</span>
              <span aria-hidden style={{ fontSize: 14, opacity: 0.7 }}>›</span>
            </>
          )}
        </button>
      </div>

      {/* 查一查 结果区（内联） */}
      {(askResult || askError) && !askLoading && (
        <>
          {askResult && (
            <AskResultPanel
              result={askResult}
              onClose={() => {
                setAskResult(null);
                setAskError(null);
              }}
            />
          )}
          {askError && !askResult && (
            <div
              style={{
                background: "#FFF1F1",
                border: "2px dashed #FDA4AF",
                borderRadius: 18,
                padding: "16px 20px",
                color: "#9F1239",
                fontSize: 15,
                lineHeight: 1.6,
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span>{askError}</span>
              <button
                type="button"
                onClick={() => setAskError(null)}
                aria-label="关闭"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#9F1239",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          区块 ②  按尺寸翻字典（精选浏览区）
          —— 整块用奶油色卡片包裹，让浏览区和上方 AI 工具区在容器层面就泾渭分明
          —— 眉标移到卡内顶部，作为卡片的"扉页标题"
          ════════════════════════════════════════════════════════ */}
      <div
        style={{
          marginTop: 36,
          background: "linear-gradient(180deg, #FFFAEC 0%, #FFF5DC 100%)",
          border: "2px solid #EFE3C2",
          borderRadius: 28,
          padding: "22px 22px 28px",
        }}
      >
        <SectionHeader
          kicker="找尺寸参考物"
          kickerColor="#A8853A"
          kickerBg="#FFF3D6"
          kickerIcon="📖"
          subtitle={`从${scales[0]?.title ?? ""}到${scales[scales.length - 1]?.title ?? ""}，共 ${scales.length} 个常用单位`}
        />

        {/* 字典浏览视图 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <ScaleRail
            scales={scales}
            activeId={activeId}
            dimensionLabel={dimensionLabel}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 44,
            }}
          >
            {scales.map((s) => (
              <ScaleSection key={s.id} scale={s} />
            ))}
            {/* 底部点睛：把刻度连起来的一句话 */}
            <div
              style={{
                textAlign: "center",
                padding: "20px 24px 4px",
                color: "var(--foreground)",
                opacity: 0.55,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              从{scales[0]?.items[0]?.label ?? "最小"}到{scales[scales.length - 1]?.items[scales[scales.length - 1]?.items.length - 1]?.label ?? "最大"}，
              <br />
              世界上所有的{dimensionLabel}都在这本字典里 �
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          区块 ③  尺博士小贴士（底部温暖收尾）
          —— 一个低调横条，作为整页的"结束语 / 安全感锚"
          ════════════════════════════════════════════════════════ */}
      <div
        style={{
          marginTop: 22,
          background: "#FFFDF6",
          border: "1.5px solid #EFE3C2",
          borderRadius: 20,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 14,
          color: "#6B5A3C",
          lineHeight: 1.6,
        }}
      >
        <img
          src={resolveAsset("/ip3.png")}
          alt="尺博士"
          style={{
            width: 44,
            height: 44,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <span
            className="font-display"
            style={{ color: "#A8853A", marginRight: 8 }}
          >
            🦉 尺博士小贴士
          </span>
          量感是理解世界的重要能力！多看看、比一比，你会越来越会"用尺子想象"～
        </div>
      </div>
    </section>
  );
}

/**
 * 根据物品尺寸返回对应"量级色"——保持搜索结果卡片和字典刻度色一致。
 * 让孩子下意识把"紫=毫米级、红=千米级"建立色彩与量级的认知锚定。
 */
function accentForSize(sizeM: number): string {
  // 与 LENGTH_DICTIONARY 各刻度 accent 对应
  const buckets: Array<[number, string]> = [
    [0.005, "#B57BFF"], // 1mm
    [0.05, "#4A90D9"], // 1cm
    [0.5, "#2EC4B6"], // 10cm
    [3, "#58CC02"], // 1m
    [50, "#FFC93C"], // 10m
    [500, "#FF9F43"], // 100m
    [Infinity, "#FF5B5B"], // 1km+
  ];
  for (const [max, color] of buckets) {
    if (sizeM < max) return color;
  }
  return "#4A3520";
}

// 给 lint 静音
void LENGTH_DICTIONARY;
