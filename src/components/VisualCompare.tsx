"use client";

/**
 * VisualCompare — 等比例视觉对比组件（v6 · 统一列布局）
 *
 * 设计决策：
 *   - 比较长度（length）时，所有物品都以"行"为单位，纵向堆叠，
 *     从短到长由上至下排列，对比最直观。
 *   - 每行：物体名 · 等比例放大后的图标 · 数值。
 *   - **等比例放大**：图标宽高同步按 ratio 缩放（保持原始正方形宽高比），
 *     长的物体图标更大，短的更小，眼睛直接感受"大小差距"。无进度条。
 *   - 最大 : 最小 视觉比例上限 = 5（默认），防止屏幕放不下也保证最小可见。
 *   - 弹性 spring 入场 + 持续微浮动，让 emoji "活"起来。
 *   - 每个物体下方有自己独立的"地面线"。无云朵、无太阳，画面聚焦。
 */

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import * as React from "react";
import type { DimensionKey } from "@/lib/dimensions";
import { ALL_REFERENCES, type ReferenceObject } from "@/lib/references";
import type { ResolvedVisual } from "@/lib/visualAssets";
import { fromSI } from "@/lib/units";
import { cn, resolveAsset } from "@/lib/utils";
import { TimeVisualRow } from "./TimeViz";

/**
 * TightIcon — Iconify 图标的"紧凑包装"
 *
 * 问题：Iconify 图标（fluent-emoji 等）原生 viewBox 自带 5%~15% 留白。
 * 如果直接渲染到 NxN 的盒子里，可见内容比盒子小，导致：
 *   - 测量横线宽度 = 盒子宽度，但视觉图标更窄 → 标注不准
 *   - 内容垂直居中 → 底部留白把图标"悬浮"起来
 *
 * 解法：图标 SVG 渲染好后，用 getBBox() 拿到内容包围盒，重写 svg.viewBox
 * 让内容紧贴边缘；同时把 preserveAspectRatio 设为 xMidYMax meet（底对齐）
 * 或 xMidYMid meet（居中），由 `bottomAlign` prop 控制。
 *
 * 副作用：getBBox 是只读测量，不会触发额外渲染。MutationObserver 监听
 * Iconify 异步加载完成的瞬间——首次同步缓存命中也会被 useLayoutEffect 兜住。
 */
/**
 * 图标容器尺寸模式。
 * - fitBox（默认）：N×N 正方盒，图标以 meet 充填一边，另一边以原生长宽比为准
 *   初代代码默认这个，但遇到“车辆、梥子”这种依赖宽高不一的图标会造成测量线不准。
 * - fitWidth：宽度 = N，高度交给浏览器按 SVG viewBox 本征纵横比计算。适合长度维度（value↔图标宽）。
 * - fitHeight：高度 = N，宽度自动。适合高度维度（value↔图标高）。
 */
type IconAspectMode = "fitBox" | "fitHeight" | "fitWidth";

interface AlphaBBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_ALPHA_BBOX: AlphaBBox = { left: 0, top: 0, width: 1, height: 1 };

function useAlphaBBoxes(srcs: (string | null)[]): Record<string, AlphaBBox> {
  const [bboxes, setBboxes] = React.useState<Record<string, AlphaBBox>>({});
  const key = srcs.filter(Boolean).join("|");

  React.useEffect(() => {
    let canceled = false;
    const valid = srcs.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (valid.length === 0) return;

    const tasks = valid.map(
      (src) =>
        new Promise<[string, AlphaBBox]>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx || !canvas.width || !canvas.height) {
              resolve([src, DEFAULT_ALPHA_BBOX]);
              return;
            }
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const a = data[(y * canvas.width + x) * 4 + 3];
                if (a > 8) {
                  if (x < minX) minX = x;
                  if (y < minY) minY = y;
                  if (x > maxX) maxX = x;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (maxX < minX || maxY < minY) {
              resolve([src, DEFAULT_ALPHA_BBOX]);
              return;
            }
            resolve([
              src,
              {
                left: minX / canvas.width,
                top: minY / canvas.height,
                width: (maxX - minX + 1) / canvas.width,
                height: (maxY - minY + 1) / canvas.height,
              },
            ]);
          };
          img.onerror = () => resolve([src, DEFAULT_ALPHA_BBOX]);
          img.src = src;
        }),
    );

    Promise.all(tasks).then((results) => {
      if (canceled) return;
      const next: Record<string, AlphaBBox> = {};
      for (const [src, bbox] of results) next[src] = bbox;
      setBboxes(next);
    });

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return bboxes;
}

function formatBySi(value: number, dimension: DimensionKey): string {
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString();
  if (dimension === "weight") {
    return value >= 1 ? `${fmt(value)}kg` : `${Math.round(value * 1000)}g`;
  }
  if (dimension === "time") {
    if (value >= 86400) return `${Math.round(value / 86400)}天`;
    if (value >= 3600) return `${Math.round(value / 3600)}小时`;
    if (value >= 60) return `${Math.round(value / 60)}分钟`;
    return `${fmt(value)}秒`;
  }
  if (dimension === "area") return `${fmt(value)}m²`;
  if (dimension === "volume") return value >= 1 ? `${fmt(value)}L` : `${Math.round(value * 1000)}mL`;
  if (dimension === "cubic") return `${fmt(value)}m³`;
  return value >= 1 ? `${fmt(value)}米` : `${Math.round(value * 100)}厘米`;
}

/**
 * 用「用户输入的单位」格式化所有对比项的尺寸：
 *   - 例：用户输入立方厘米 → 全部物体显示 "216立方厘米 / 1立方厘米 / 5000立方厘米"
 *   - 单位未识别时退回 formatBySi（按 SI 选择友好单位）
 */
function formatInTargetUnit(
  siValue: number,
  dimension: DimensionKey,
  targetUnit?: string,
): string {
  if (!targetUnit) return formatBySi(siValue, dimension);
  const v = fromSI(siValue, targetUnit, dimension);
  if (v == null || !Number.isFinite(v)) return formatBySi(siValue, dimension);
  // 大跨度时小数位适配：v < 0.01 用 4 位防止显示成 0
  const fmt = (n: number) => {
    const abs = Math.abs(n);
    const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4;
    return Number.isInteger(n)
      ? String(n)
      : parseFloat(n.toFixed(digits)).toString();
  };
  return `${fmt(v)}${targetUnit}`;
}

function wrapStyleFor(mode: IconAspectMode, size: number): React.CSSProperties {
  switch (mode) {
    case "fitWidth":
      return { display: "inline-block", width: size, height: "auto", lineHeight: 0 };
    case "fitHeight":
      // 用 inline-flex 让子 svg 能各躭取本征宽度
      return { display: "inline-flex", height: size, width: "auto", lineHeight: 0 };
    case "fitBox":
    default:
      return { display: "inline-block", width: size, height: size, lineHeight: 0 };
  }
}

function TightIcon({
  icon,
  size,
  bottomAlign = false,
  aspectMode = "fitBox",
  className,
  style,
}: {
  icon: string;
  size: number;
  /** true = 内容贴到盒子底边（地面线对齐），适合 length / 立方体场景 */
  bottomAlign?: boolean;
  aspectMode?: IconAspectMode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const wrapRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const tighten = () => {
      const svg = wrap.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return false;
      // 已处理过则跳过——避免重复 setAttribute
      if (svg.dataset.tight === "1") return true;
      try {
        const bb = svg.getBBox();
        if (
          !isFinite(bb.width) ||
          !isFinite(bb.height) ||
          bb.width <= 0 ||
          bb.height <= 0
        ) {
          return false;
        }
        // 留极小描边裕量，防止反锯齿被切
        const pad = Math.max(bb.width, bb.height) * 0.005;
        svg.setAttribute(
          "viewBox",
          `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`,
        );
        svg.setAttribute(
          "preserveAspectRatio",
          bottomAlign ? "xMidYMax meet" : "xMidYMid meet",
        );
        svg.dataset.tight = "1";
        return true;
      } catch {
        return false;
      }
    };

    // 立即试一次（同步缓存命中场景）
    if (tighten()) return;

    // 否则监听 SVG 出现/更新
    const obs = new MutationObserver(() => {
      if (tighten()) obs.disconnect();
    });
    obs.observe(wrap, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [icon, bottomAlign]);

  return (
    <span
      ref={wrapRef}
      className={className}
      style={{ ...wrapStyleFor(aspectMode, size), ...style }}
      aria-hidden
    >
      <Icon
        icon={icon}
        width={aspectMode === "fitHeight" ? undefined : size}
        height={aspectMode === "fitWidth" ? undefined : size}
        aria-hidden
      />
    </span>
  );
}

/**
 * InlineSvgFromUrl — 把外部 SVG 文件内联到 DOM，再用 getBBox 紧化
 *
 * 为什么不用 <img>：<img> 内部是图像合成不可触达的 shadow root，无法 getBBox。
 * 这里改成 fetch SVG 文本，挂到 span 的 innerHTML，与 TightIcon 走同一套裁剪逻辑。
 *
 * 同时去掉 svg 标签自带的 width/height（让其继承包装层尺寸），保证缩放跟随父盒。
 */
function InlineSvgFromUrl({
  url,
  size,
  bottomAlign = false,
  aspectMode = "fitBox",
  className,
  style,
  onError,
}: {
  url: string;
  size: number;
  bottomAlign?: boolean;
  aspectMode?: IconAspectMode;
  className?: string;
  style?: React.CSSProperties;
  /** 取 SVG 失败（404/网络）时回调，外层可切换到 fallback 路径 */
  onError?: () => void;
}) {
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const [svgHtml, setSvgHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch(resolveAsset(url))
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const text = await r.text();
        // 兜底：内容必须以 <svg 开头，否则视为非 SVG（防 404 页面被误注入）
        if (!/^\s*<\?xml|^\s*<svg\b/i.test(text)) {
          throw new Error("not-svg");
        }
        return text;
      })
      .then((text) => {
        if (!alive) return;
        // 去掉 svg 根标签上的 width/height，让 CSS 控制尺寸；保留 viewBox/preserveAspectRatio
        const cleaned = text.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
          const stripped = attrs
            .replace(/\swidth\s*=\s*"[^"]*"/i, "")
            .replace(/\sheight\s*=\s*"[^"]*"/i, "");
          return `<svg${stripped}>`;
        });
        setSvgHtml(cleaned);
      })
      .catch(() => {
        if (!alive) return;
        // 失败保持 svgHtml=null（不渲染任何 HTML），同时通知外层做 fallback
        onError?.();
      });
    return () => {
      alive = false;
    };
  }, [url, onError]);

  React.useLayoutEffect(() => {
    if (!svgHtml) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const svg = wrap.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // 根据 aspectMode 让 svg 适应盒子。viewBox 保证内部还原本征长宽比。
    if (aspectMode === "fitWidth") {
      svg.style.width = "100%";
      svg.style.height = "auto";
      svg.style.display = "block";
    } else if (aspectMode === "fitHeight") {
      svg.style.width = "auto";
      svg.style.height = "100%";
      svg.style.display = "block";
    } else {
      svg.style.width = "100%";
      svg.style.height = "100%";
    }

    // 烘焙过的 SVG 自带 data-tight="1"，不必再 getBBox。只需按 bottomAlign 调对齐。
    if (svg.dataset.tight === "1") {
      svg.setAttribute(
        "preserveAspectRatio",
        bottomAlign ? "xMidYMax meet" : "xMidYMid meet",
      );
      return;
    }

    // 未预紧化 → runtime getBBox 兜底
    try {
      const bb = svg.getBBox();
      if (
        !isFinite(bb.width) ||
        !isFinite(bb.height) ||
        bb.width <= 0 ||
        bb.height <= 0
      )
        return;
      const pad = Math.max(bb.width, bb.height) * 0.005;
      svg.setAttribute(
        "viewBox",
        `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`,
      );
      svg.setAttribute(
        "preserveAspectRatio",
        bottomAlign ? "xMidYMax meet" : "xMidYMid meet",
      );
      svg.dataset.tight = "1";
    } catch {
      /* noop */
    }
  }, [svgHtml, bottomAlign, aspectMode]);

  return (
    <span
      ref={wrapRef}
      className={className}
      style={{ ...wrapStyleFor(aspectMode, size), ...style }}
      aria-hidden
      dangerouslySetInnerHTML={svgHtml ? { __html: svgHtml } : undefined}
    />
  );
}

/** 已烘焙的 iconify set——这些 ID 走本地 /icons/iconify/{set}/{name}.svg
 *  与 scripts/bake-icons.mjs 的 SETS 保持同步。 */
const BAKED_SETS = new Set(["fluent-emoji", "openmoji", "mdi", "game-icons"]);

/**
 * PixelIcon — 16×16 像素画
 *
 * 优先 /icons/pixel/{slug}.svg（AI 端点 /api/ai/pixel 产物，rect 矢量）
 * 404 时 fallback 到 /icons/pixel/{slug}.png（pixel-bake SDXL 产物）
 *
 * 渲染策略：
 *   - 用 <img> 而非 InlineSvgFromUrl，因为像素画 viewBox 已是 0 0 16 16，无需 getBBox 紧化
 *   - image-rendering: pixelated 让 PNG 缩放时保持硬边；SVG rect 本身就是精确矢量，不受影响
 *   - bottomAlign 对像素画意义不大（16 单位整体就这么大），用 objectPosition 简单实现
 */
function PixelIcon({
  slug,
  size,
  bottomAlign = false,
  aspectMode = "fitBox",
  prefer = "svg",
  className,
  style,
}: {
  slug: string;
  size: number;
  bottomAlign?: boolean;
  aspectMode?: IconAspectMode;
  prefer?: "svg" | "png";
  className?: string;
  style?: React.CSSProperties;
}) {
  // slug 允许带 "?bust=<ts>" 用作 cache-bust 触发 <img> 重载（bake-on-demand 完成后）
  const [pureSlug, bust] = (() => {
    const i = slug.indexOf("?");
    return i < 0 ? [slug, ""] : [slug.slice(0, i), slug.slice(i)];
  })();
  const src = resolveAsset(`/icons/pixel/${pureSlug}.${prefer}${bust}`);

  return (
    <span
      className={className}
      style={{ ...wrapStyleFor(aspectMode, size), ...style, position: "relative" }}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        onError={(e) => {
          // svg 没有就试 png；png 也 404 就再 fallback 到 AI 草图端点；
          // 都不行 → 隐藏破图标志（透明）。
          const img = e.currentTarget;
          const tried = (img.dataset.fallbackStep as string | undefined) ?? "0";
          if (prefer === "svg" && tried === "0") {
            img.dataset.fallbackStep = "1";
            img.src = resolveAsset(`/icons/pixel/${pureSlug}.png${bust}`);
            return;
          }
          if (tried === "0" || tried === "1") {
            img.dataset.fallbackStep = "2";
            // /api/ai/sketch 流程产物是 SVG；这里直接交由后端 AI 生成。
            // 注意：sketch 端点用 GET 不行，得 POST——所以兜底改成显示一个占位符。
            // 简单起见：换成不可见的 1×1 png 占位（不挡布局）。
            img.style.opacity = "0.15";
            img.src =
              "data:image/svg+xml;utf8," +
              encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text x='50%' y='55%' font-size='14' text-anchor='middle' dominant-baseline='middle'>?</text></svg>`,
              );
          }
        }}
        style={{
          width: aspectMode === "fitHeight" ? "auto" : "100%",
          height: aspectMode === "fitWidth" ? "auto" : "100%",
          objectFit: "contain",
          objectPosition: bottomAlign ? "center bottom" : "center center",
          imageRendering: "pixelated",
          display: "block",
        }}
      />
      <span 
        className="absolute bottom-0 right-0 text-[9px] text-white opacity-80 scale-[0.75] origin-bottom-right pointer-events-none select-none"
        style={{ fontFamily: '"Alibaba PuHuiTi", sans-serif' }}
      >
        AI生成
      </span>
    </span>
  );
}

function GeneratedTargetPixelIcon({
  label,
  size,
  bottomAlign = false,
  aspectMode = "fitBox",
  className,
  style,
}: {
  label: string;
  size: number;
  bottomAlign?: boolean;
  aspectMode?: IconAspectMode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let canceled = false;
    async function ensureIcon() {
      const normalized = label.trim().toLowerCase();
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(normalized),
      );
      const hex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const localUrl = resolveAsset(`/icons/pixel/${hex.slice(0, 12)}.svg`);
      if (!canceled) setSrc(localUrl);
      const probe = await fetch(localUrl, { method: "HEAD" }).catch(() => null);
      if (probe?.ok || canceled) return;
      const res = await fetch(resolveAsset("/api/ai/pixel"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object: label }),
      }).catch(() => null);
      if (!res?.ok || canceled) return;
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (data?.url && !canceled) setSrc(resolveAsset(`${data.url}?v=${Date.now()}`));
    }
    ensureIcon();
    return () => {
      canceled = true;
    };
  }, [label]);

  if (!src) {
    return <TightIcon icon="fluent-emoji:triangular-ruler" size={size} />;
  }

  return (
    <span
      className={className}
      style={{ ...wrapStyleFor(aspectMode, size), ...style, position: "relative" }}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        style={{
          width: aspectMode === "fitHeight" ? "auto" : "100%",
          height: aspectMode === "fitWidth" ? "auto" : "100%",
          objectFit: "contain",
          objectPosition: bottomAlign ? "center bottom" : "center center",
          imageRendering: "pixelated",
          display: "block",
        }}
      />
      <span 
        className="absolute bottom-0 right-0 text-[9px] text-white opacity-80 scale-[0.75] origin-bottom-right pointer-events-none select-none"
        style={{ fontFamily: '"Alibaba PuHuiTi", sans-serif' }}
      >
        AI生成
      </span>
    </span>
  );
}

/**
 * SmartIcon — 统一图标入口
 *
 * 路由规则（按前缀）：
 *   - "generated:xxx"        → /icons/generated/xxx.svg（AI 简笔画）
 *   - "fluent-emoji:xxx" 等  → /icons/iconify/{set}/xxx.svg（已被 bake-icons 脚本预先紧化 viewBox）
 *   - 其他未烘焙 set         → fallback 到 @iconify/react 网络/包加载，再 runtime getBBox 兜底
 *
 * 都走 InlineSvgFromUrl 是为了：
 *   1. SVG 直接进 DOM，可拿 getBBox 二次校验
 *   2. 同源静态资源，命中 CDN/serviceworker 缓存最佳
 *   3. 离线可用——不再依赖 Iconify CDN
 */
function SmartIcon({
  iconifyId,
  size,
  bottomAlign = false,
  aspectMode = "fitBox",
  className,
  style,
}: {
  iconifyId: string;
  size: number;
  bottomAlign?: boolean;
  aspectMode?: IconAspectMode;
  className?: string;
  style?: React.CSSProperties;
}) {
  // 这个 ID 的本地烘焙文件 404 / 非 SVG 时，切到 Iconify runtime 兜底
  const [failedIconifyId, setFailedIconifyId] = React.useState<string | null>(
    null,
  );
  const bakedFailed = failedIconifyId === iconifyId;
  const handleBakedError = React.useCallback(() => {
    setFailedIconifyId(iconifyId);
  }, [iconifyId]);

  // pixel:{slug} → 本地 16×16 像素画（SVG 走 InlineSvgFromUrl，PNG 走 <img>）
  // SVG 来源：/api/ai/pixel 端点把 MiMo 输出落盘到 public/icons/pixel/{slug}.svg
  // PNG 来源：scripts/pixel-bake/bake.py（SDXL 流水线）落盘到同目录
  // 优先 SVG，404 时再 fallback 到 PNG
  if (iconifyId.startsWith("pixel:")) {
    return (
      <PixelIcon
        slug={iconifyId.slice("pixel:".length)}
        size={size}
        bottomAlign={bottomAlign}
        aspectMode={aspectMode}
        className={className}
        style={style}
      />
    );
  }

  if (iconifyId.startsWith("pixel-png:")) {
    return (
      <PixelIcon
        slug={iconifyId.slice("pixel-png:".length)}
        size={size}
        bottomAlign={bottomAlign}
        aspectMode={aspectMode}
        prefer="png"
        className={className}
        style={style}
      />
    );
  }

  if (iconifyId.startsWith("pixel-ai:")) {
    return (
      <GeneratedTargetPixelIcon
        label={decodeURIComponent(iconifyId.slice("pixel-ai:".length))}
        size={size}
        bottomAlign={bottomAlign}
        aspectMode={aspectMode}
        className={className}
        style={style}
      />
    );
  }

  if (iconifyId.startsWith("generated:")) {
    return (
      <InlineSvgFromUrl
        url={`/icons/generated/${iconifyId.slice("generated:".length)}.svg`}
        size={size}
        bottomAlign={bottomAlign}
        aspectMode={aspectMode}
        className={className}
        style={style}
      />
    );
  }

  const colonIdx = iconifyId.indexOf(":");
  if (!bakedFailed && colonIdx > 0) {
    const set = iconifyId.slice(0, colonIdx);
    const name = iconifyId.slice(colonIdx + 1);
    if (BAKED_SETS.has(set)) {
      return (
        <InlineSvgFromUrl
          url={`/icons/iconify/${set}/${name}.svg`}
          size={size}
          bottomAlign={bottomAlign}
          aspectMode={aspectMode}
          className={className}
          style={style}
          onError={handleBakedError}
        />
      );
    }
  }

  // 未烘焙的 set 或本地 404 → 走 Iconify runtime + getBBox 兑底
  return (
    <TightIcon
      icon={iconifyId}
      size={size}
      bottomAlign={bottomAlign}
      aspectMode={aspectMode}
      className={className}
      style={style}
    />
  );
}

interface Props {
  /** 用户输入的物体名（"楼层"） */
  targetLabel: string;
  /** 用户输入数值的 SI 数值（米） */
  targetValueSi: number;
  /** 用户输入显示用文案（"200 米"） */
  targetValueDisplay: string;
  /**
   * 用户输入的原始单位（"立方厘米" / "米" / "千克" ...）。
   * 提供后，所有对比项的尺寸标签都会换算成该单位 + 该单位字面值显示，
   * 让小学生在同一个量纲单位下读出数字，避免"0.000216m³"显示成"0m³"。
   */
  targetUnit?: string;
  /** AI 返回的 object_type，用来挑 icon */
  targetType?: string;
  /** AI 直接挑好的 Iconify 图标 ID（优先使用） */
  targetIcon?: string;
  targetVisual?: ResolvedVisual;
  /**
   * 服务端 iconRegistry 给每个 ref_id 查到的 Iconify ID。
   * 来自 /api/ai/parse 的 `ref_icons` 字段，优先于内置硬编码 map。
   */
  refIcons?: Record<string, string>;
  refVisuals?: Record<string, ResolvedVisual>;
  /** 对比参考物 */
  references: ReferenceObject[];
  /**
   * 比较轴向：
   *   - "horizontal"（默认）：长 / 宽 / 厚 — 项目竖向堆叠，测量线在图标下方
   *   - "vertical"：高 — 项目横向并排在地面线上，测量线在图标右侧
   * （仅在 dimension="length" 时生效）
   */
  targetAxis?: "horizontal" | "vertical";
  /**
   * 比较维度：决定整体渲染模式 + 标签文案 + 数值格式化
   * - "length"：长度对比（按 axis 分横/竖）
   * - "area"：面积对比（边长 ∝ √面积 的并排正方形）
   */
  dimension?: DimensionKey;
  /** 白板大屏：放大字号、行高 */
  whiteboard?: boolean;
  className?: string;
}

/** 参考物 ID → Iconify Fluent Emoji 图标名 */
const REF_ID_TO_ICON: Record<string, string> = {
  sesame: "fluent-emoji:seedling",
  ant: "fluent-emoji:ant",
  coin: "fluent-emoji:coin",
  thumb_width: "fluent-emoji:thumbs-up",
  pencil: "fluent-emoji:pencil",
  chopstick: "fluent-emoji:chopsticks",
  ruler_30cm: "fluent-emoji:straight-ruler",
  school_desk: "fluent-emoji:chair",
  arm_span_child: "fluent-emoji:raising-hands",
  child_height: "fluent-emoji:child",
  adult_height: "fluent-emoji:person-standing",
  bed: "fluent-emoji:bed",
  car: "fluent-emoji:automobile",
  school_bus: "fluent-emoji:bus",
  coconut_tree: "fluent-emoji:palm-tree",
  blue_whale: "fluent-emoji:whale",
  basketball_court: "fluent-emoji:stadium",
  school_building: "fluent-emoji:school",
  soccer_field: "fluent-emoji:stadium",
  haikou_dayuecheng: "fluent-emoji:office-building",
  burj_khalifa: "fluent-emoji:tokyo-tower",
  running_track: "fluent-emoji:person-running",
  haikou_bay_bridge: "fluent-emoji:bridge-at-night",
  mount_everest: "fluent-emoji:snow-capped-mountain",
  hainan_island_width: "fluent-emoji:desert-island",
  // —— 面积维度（fallback；正常走 iconRegistry 服务端查找） ——
  stamp: "fluent-emoji:postage-stamp",
  business_card: "fluent-emoji:identification-card",
  phone_screen: "fluent-emoji:mobile-phone",
  math_textbook: "fluent-emoji:closed-book",
  a4_paper: "fluent-emoji:page-facing-up",
  newspaper_open: "fluent-emoji:newspaper",
  school_desk_top: "fluent-emoji:chair",
  double_bed: "fluent-emoji:bed",
  ping_pong_table: "fluent-emoji:ping-pong",
  parking_spot: "fluent-emoji:p-button",
  classroom_floor: "fluent-emoji:school",
  small_apartment: "fluent-emoji:house",
  basketball_half_court: "fluent-emoji:basketball",
  basketball_full_court: "fluent-emoji:basketball",
  tennis_court: "fluent-emoji:tennis",
  running_track_inner: "fluent-emoji:stadium",
  soccer_field_area: "fluent-emoji:soccer-ball",
  tiananmen_square: "fluent-emoji:classical-building",
  birds_nest: "fluent-emoji:stadium",
  forbidden_city: "fluent-emoji:castle",
  central_park_ny: "fluent-emoji:deciduous-tree",
  haikou_meilan_airport: "fluent-emoji:airplane-arrival",
  hzmb_bridge: "fluent-emoji:bridge-at-night",
  // —— 容积维度 ——
  eyedropper_drop: "fluent-emoji:droplet",
  spoon_teaspoon: "fluent-emoji:spoon",
  soup_spoon: "fluent-emoji:spoon",
  yogurt_cup: "fluent-emoji:glass-of-milk",
  tea_cup: "fluent-emoji:hot-beverage",
  soda_can: "fluent-emoji:beverage-box",
  mineral_water_bottle: "fluent-emoji:droplet",
  milk_carton: "fluent-emoji:glass-of-milk",
  kettle: "fluent-emoji:teapot",
  rice_cooker: "fluent-emoji:cooked-rice",
  bucket_household: "fluent-emoji:glass-of-milk",
  bathtub: "fluent-emoji:bathtub",
  fish_tank_home: "fluent-emoji:tropical-fish",
  water_tanker_truck: "fluent-emoji:articulated-lorry",
  swimming_pool_kid: "fluent-emoji:person-swimming",
  // —— 体积维度 ——
  sesame_cubic: "fluent-emoji:seedling",
  rice_grain: "fluent-emoji:cooked-rice",
  dice: "fluent-emoji:game-die",
  ping_pong_ball: "fluent-emoji:ping-pong",
  rubiks_cube: "fluent-emoji:ice",
  tennis_ball: "fluent-emoji:tennis",
  shoe_box: "fluent-emoji:running-shoe",
  basketball: "fluent-emoji:basketball",
  microwave: "fluent-emoji:package",
  school_bag_volume: "fluent-emoji:backpack",
  fridge_household: "fluent-emoji:ice",
  washing_machine: "fluent-emoji:basket",
  small_car_volume: "fluent-emoji:automobile",
  shipping_container: "fluent-emoji:package",
  classroom_volume: "fluent-emoji:school",
  school_pool: "fluent-emoji:person-swimming",
  ten_floor_building_volume: "fluent-emoji:office-building",
  // —— 重量维度 ——
  feather: "fluent-emoji:feather",
  paperclip: "fluent-emoji:paperclip",
  coin_1yuan: "fluent-emoji:coin",
  egg_weight: "fluent-emoji:egg",
  apple_weight: "fluent-emoji:red-apple",
  textbook_weight: "fluent-emoji:closed-book",
  mineral_bottle_full: "fluent-emoji:droplet",
  schoolbag_weight: "fluent-emoji:backpack",
  watermelon: "fluent-emoji:watermelon",
  cat_weight: "fluent-emoji:cat",
  dog_big_weight: "fluent-emoji:dog",
  primary_kid_weight: "fluent-emoji:child",
  adult_weight: "fluent-emoji:person-standing",
  dolphin_weight: "fluent-emoji:dolphin",
  panda_adult: "fluent-emoji:panda",
  small_car_weight: "fluent-emoji:automobile",
  elephant_weight: "fluent-emoji:elephant",
  blue_whale_weight: "fluent-emoji:whale",
  // —— 时间维度 ——
  blink_eye: "fluent-emoji:eye",
  snap_finger: "fluent-emoji:ok-hand",
  heartbeat: "fluent-emoji:red-heart",
  deep_breath: "fluent-emoji:dashing-away",
  brush_teeth: "fluent-emoji:toothbrush",
  boil_egg: "fluent-emoji:egg",
  recess_break: "fluent-emoji:person-running",
  school_lesson: "fluent-emoji:school",
  cartoon_movie: "fluent-emoji:clapper-board",
  school_morning: "fluent-emoji:sunrise",
  night_sleep: "fluent-emoji:sleeping-face",
  one_day: "fluent-emoji:sun",
  one_week: "fluent-emoji:spiral-calendar",
  winter_holiday: "fluent-emoji:snowflake",
  summer_holiday: "fluent-emoji:beach-with-umbrella",
  one_school_year: "fluent-emoji:books",
  one_year: "fluent-emoji:calendar",
};

/** 用户输入物：object_type → Iconify */
const TYPE_TO_ICON: Record<string, string> = {
  building: "fluent-emoji:office-building",
  vehicle: "fluent-emoji:automobile",
  body: "fluent-emoji:person-standing",
  animal: "fluent-emoji:dog",
  stationery: "fluent-emoji:pencil",
  furniture: "fluent-emoji:chair",
  nature: "fluent-emoji:deciduous-tree",
  tree: "fluent-emoji:palm-tree",
  tower: "fluent-emoji:tokyo-tower",
  bridge: "fluent-emoji:bridge-at-night",
  road: "fluent-emoji:bridge-at-night",
  mountain: "fluent-emoji:snow-capped-mountain",
  food: "fluent-emoji:red-apple",
  electronic: "fluent-emoji:mobile-phone",
  unknown: "fluent-emoji:triangular-ruler",
};

const TARGET_ALIAS_TO_REF_ID: Array<[RegExp, string]> = [
  [/(卡车|货车|水罐车|洒水车)/, "water_tanker_truck"],
  [/(小汽车|汽车|轿车|车子)/, "car"],
  [/(校车|巴士|公交车|公交)/, "school_bus"],
  [/(椰子树|椰树)/, "coconut_tree"],
  [/(蓝鲸|鲸鱼)/, "blue_whale"],
  [/(蚂蚁)/, "ant"],
  [/(铅笔)/, "pencil"],
  [/(床)/, "bed"],
  [/(篮球场)/, "basketball_court"],
  [/(A4纸|A4|纸张)/i, "a4_paper"],
  [/(矿泉水瓶|矿泉水)/, "mineral_water_bottle"],
  [/(浴缸)/, "bathtub"],
  [/(骰子)/, "dice"],
  [/(苹果)/, "apple_weight"],
  [/(猫)/, "cat_weight"],
];

function pickTargetPixelRefId(targetLabel: string): string | null {
  const normalized = targetLabel.trim().toLowerCase();
  for (const [re, id] of TARGET_ALIAS_TO_REF_ID) {
    if (re.test(targetLabel)) return id;
  }
  const exact = ALL_REFERENCES.find(
    (r) => r.label.trim().toLowerCase() === normalized,
  );
  if (exact) return exact.id;
  const contained = ALL_REFERENCES.find((r) => {
    const label = r.label.trim().toLowerCase();
    return normalized.includes(label) || label.includes(normalized);
  });
  return contained?.id ?? null;
}

function pickTargetIcon(
  targetLabel: string,
  targetType?: string,
  aiIcon?: string,
  targetVisual?: ResolvedVisual,
): string {
  if (targetVisual?.iconId) return targetVisual.iconId;
  const pixelRefId = pickTargetPixelRefId(targetLabel);
  if (pixelRefId) return `pixel-png:${pixelRefId}`;
  if (targetLabel.trim()) return `pixel-ai:${encodeURIComponent(targetLabel.trim())}`;
  // 1) AI / 服务端 iconRegistry 给的图标 ID（含 openmoji:/game-icons:/mdi:/fluent-emoji: 等前缀）优先用
  if (aiIcon && aiIcon.includes(":")) return aiIcon;
  // 2) 关键词正则——更具象，胜于类别兜底
  const t = targetLabel;
  const map: [RegExp, string][] = [
    [/(楼|大厦|塔楼|住宅|公寓|教学楼|商场)/, "fluent-emoji:office-building"],
    [/(椰子|椰树)/, "fluent-emoji:palm-tree"],
    [/(树|林)/, "fluent-emoji:deciduous-tree"],
    [/(卡车|货车)/, "fluent-emoji:articulated-lorry"],
    [/(校车|公交)/, "fluent-emoji:bus"],
    [/(车|轿车|汽车|出租)/, "fluent-emoji:automobile"],
    [/(山|峰|岭)/, "fluent-emoji:snow-capped-mountain"],
    [/(桥|大桥)/, "fluent-emoji:bridge-at-night"],
    [/(塔|铁塔)/, "fluent-emoji:tokyo-tower"],
    [/(蚂蚁)/, "fluent-emoji:ant"],
    [/(虫|蜜蜂|甲虫)/, "fluent-emoji:beetle"],
    [/(狗)/, "fluent-emoji:dog"],
    [/(猫)/, "fluent-emoji:cat"],
    [/(兔)/, "fluent-emoji:rabbit"],
    [/(象)/, "fluent-emoji:elephant"],
    [/(鲸)/, "fluent-emoji:whale"],
    [/(铅笔)/, "fluent-emoji:pencil"],
    [/(橡皮|尺|文具)/, "fluent-emoji:straight-ruler"],
    [/(小朋友|孩子|学生)/, "fluent-emoji:child"],
    [/(人|老师|大人)/, "fluent-emoji:person-standing"],
    [/(海岛|岛屿|海南岛)/, "fluent-emoji:desert-island"],
    [/(跑道|赛道)/, "fluent-emoji:person-running"],
    [/(操场|球场|足球场|体育场|赛场)/, "fluent-emoji:stadium"],
    [/(路|马路|公路|高速)/, "fluent-emoji:bridge-at-night"],
  ];
  for (const [re, icon] of map) if (re.test(t)) return icon;
  // 3) 用 object_type 做类别兜底（仅在前面都没匹配上时）
  if (targetType && TYPE_TO_ICON[targetType]) return TYPE_TO_ICON[targetType];
  return "fluent-emoji:triangular-ruler";
}

/**
 * 取一个 ref 的图标 ID。优先级：
 *   1) 服务端 iconRegistry 查出来的（refIcons[ref.id]，来自 /api/ai/parse）
 *   2) 内置硬编码 map（向后兼容，主要用于纯前端测试）
 *   3) 通用兜底
 */
function getRefIcon(
  ref: ReferenceObject,
  refIcons?: Record<string, string>,
  refVisuals?: Record<string, ResolvedVisual>,
): string {
  const resolvedVisual = refVisuals?.[ref.id];
  if (resolvedVisual?.iconId) return resolvedVisual.iconId;
  return `pixel-png:${ref.id}`;
}

interface CompareItem {
  key: string;
  label: string;
  iconifyId: string;
  size: number; // 米
  sizeDisplay: string;
  isTarget: boolean;
  hainan?: boolean;
}

export function VisualCompare({
  targetLabel,
  targetValueSi,
  targetValueDisplay: _targetValueDisplay,
  targetUnit,
  targetType,
  targetIcon,
  targetVisual,
  refIcons,
  refVisuals,
  references,
  targetAxis = "horizontal",
  dimension = "length",
  whiteboard = false,
  className,
}: Props) {
  // 构造对比清单（参考物 + 用户物），按 size 升序——短在上、长在下
  const items: CompareItem[] = React.useMemo(() => {
    const refs: CompareItem[] = references.map((r) => ({
      key: `ref-${r.id}`,
      label: r.label,
      iconifyId: getRefIcon(r, refIcons, refVisuals),
      size: r.size,
      // 统一展示单位：优先用用户输入的 targetUnit；否则按 SI 选友好单位
      sizeDisplay: formatInTargetUnit(r.size, dimension, targetUnit),
      isTarget: false,
      hainan: r.hainan,
    }));
    const target: CompareItem = {
      key: "target",
      label: targetLabel,
      iconifyId: pickTargetIcon(targetLabel, targetType, targetIcon, targetVisual),
      size: targetValueSi,
      sizeDisplay: formatInTargetUnit(targetValueSi, dimension, targetUnit),
      isTarget: true,
    };
    return [...refs, target].sort((a, b) => a.size - b.size);
  }, [
    references,
    targetLabel,
    targetValueSi,
    targetType,
    targetIcon,
    targetVisual,
    refIcons,
    refVisuals,
    dimension,
    targetUnit,
  ]);

  // ━━━ 视觉尺寸算法（严格线性等比，按轴向分两种布局）━━━
  //
  // 小学生只理解"按比例"，所以严格线性，**不加任何"标签最小宽度"兜底**——
  // 那种兜底会把"5 千米"和"8 千米"两个不同的项压成相同视觉尺寸，破坏比例感。
  // 服务端 3 倍约束已保证 ratio_min ≥ 1/3，最小项也是最大项的 1/3，足够辨识。
  const STAGE_INNER_HEIGHT = whiteboard ? 560 : 448;
  const STAGE_INNER_WIDTH = whiteboard ? 880 : 600;
  const measureLineH = whiteboard ? 28 : 22;
  const gapPx = whiteboard ? 14 : 10;
  const labelW = whiteboard ? 160 : 124;

  const realMax = Math.max(...items.map((i) => i.size), 1e-6);

  // 严格线性：每个 item 的"理想宽度/高度"和真实尺寸严格成正比。
  // ratios[i] = realSize / realMax，最大物 1.0，其他按比例落在 (0,1]
  const ratios = items.map((it) => it.size / realMax);
  const N = items.length;

  // ⚠️ Hooks 必须无条件调用：把所有 pixel-png 物品的 alpha bbox 在最外层算好，
  //    后续不同维度分支按需读取。
  const pixelSrcs = items.map((it) => {
    if (!it.iconifyId.startsWith("pixel-png:")) return null;
    const raw = it.iconifyId.slice("pixel-png:".length);
    const qi = raw.indexOf("?");
    const slug = qi < 0 ? raw : raw.slice(0, qi);
    const bust = qi < 0 ? "" : raw.slice(qi);
    return resolveAsset(`/icons/pixel/${slug}.png${bust}`);
  });
  const bboxes = useAlphaBBoxes(pixelSrcs);
  const itemBBoxes = pixelSrcs.map((src) =>
    src && bboxes[src] ? bboxes[src] : DEFAULT_ALPHA_BBOX,
  );
  const bodyAspects = itemBBoxes.map((b) =>
    b.height > 0 ? b.width / b.height : 1,
  );

  // 根据维度 + 轴向决定标签后缀文案
  const axisWord =
    dimension === "area"
      ? "面积"
      : dimension === "volume"
        ? "容积"
        : dimension === "cubic"
          ? "体积"
          : targetAxis === "vertical"
            ? "高度"
            : "长度";

  if (dimension === "weight") {
    // ━━━ 重量布局：天平动画 ━━━
    // 教学含义：把"用户物"放在左盘，每个参考物放右盘，做一组（或多组）天平。
    // 物体从空中落下入盘，然后梁按 log2(质量比) 倾斜——重的一边压下去。
    // 比"进度条"形象得多，孩子能"看见"哪边沉。
    const target = items.find((it) => it.isTarget);
    const refs = items.filter((it) => !it.isTarget);
    if (!target) return null;
    const scaleH = whiteboard ? 320 : 260;
    const scaleW = Math.min(STAGE_INNER_WIDTH, whiteboard ? 910 : 420);
    return (
      <div
        className={cn("relative w-full select-none", className)}
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 6%, #fff), transparent)",
          borderRadius: 16,
          padding: whiteboard ? "20px 24px" : "14px 18px",
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{ gap: whiteboard ? 18 : 14 }}
        >
          {refs.map((ref, idx) => (
            <BalanceScale
              // key 包含双方 size 和 label——任意一项变化就 remount，
              // 让 framer-motion 重新从 initial（rotate=0，平的）开始动画，
              // 否则会"从上一次倾斜角度滑到新角度"，看不到先掉物体再倾斜的过程。
              key={`${ref.key}-${target.size}-${ref.size}-${target.label}-${ref.label}`}
              left={target}
              right={ref}
              width={scaleW}
              height={scaleH}
              whiteboard={whiteboard}
              delay={idx * 0.4}
            />
          ))}
        </div>
      </div>
    );
  }

  if (dimension === "time") {
    // ━━━ 时间布局：秒表 / 时钟 / 日历 三段式 ━━━
    // 按物品时长分桶：< 60s → 秒表 / < 1天 → 时钟 / ≥ 1天 → 日历。
    // 每个物品独占一列，上半行显示名字+数值，下半行显示对应的可视化。
    // 动画速度按真实时长比例分配（≤10× 线性，超过 sqrt 缓和），共享 rAF 时钟统一复位。
    return (
      <div
        className={cn("relative w-full select-none", className)}
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 6%, #fff), transparent)",
          borderRadius: 16,
          padding: whiteboard ? "20px 24px" : "14px 18px",
        }}
      >
        <TimeVisualRow
          items={items}
          whiteboard={whiteboard}
          stageW={STAGE_INNER_WIDTH}
          renderNamePill={(it) => (
            <ItemNamePill
              item={it as CompareItem}
              whiteboard={whiteboard}
              axisWord="时间"
            />
          )}
        />
      </div>
    );
  }

  if (dimension === "volume" || dimension === "cubic") {
    // ━━━ 体积/容积布局：并排等距投影立方体（棱长 ∝ ∛size）━━━
    // 教学含义：让孩子直观感受"8 倍体积 = 2 倍棱长"，"27 倍体积 = 3 倍棱长"。
    // 容积模式额外渲染水位填充，强化"装液体"的直觉。
    const labelPillH = whiteboard ? 30 : 26;
    const labelGap = 6;

    const sideRatios = ratios.map((r) => Math.cbrt(r));
    const isVolume = dimension === "volume";
    const minCubeSide = whiteboard ? 80 : 64;
    // 体积（立方体）：等距投影宽 = side × 1.4，竖向露顶面 → side × 1.15
    // 容积（烧杯）  ：宽 = side × 1.22 × 0.745 ≈ 0.91，高 = side × 1.22
    // 两套维度几何不同，必须分别算预算否则烧杯会被严重压小（容积模式留白巨大）。
    const widthPerSide = isVolume ? 1.22 * BEAKER_ASSET.aspect : 1.4;
    const heightPerSide = isVolume ? 1.22 : 1.15;
    const hiCap = isVolume ? (whiteboard ? 420 : 320) : whiteboard ? 220 : 170;
    const verticalBudget = STAGE_INNER_HEIGHT - labelPillH - labelGap;
    const horizontalIconBudget =
      STAGE_INNER_WIDTH - Math.max(0, N - 1) * gapPx;

    const totalIsoW = (m: number) =>
      sideRatios.reduce(
        (acc, r) => acc + Math.max(minCubeSide, m * r) * widthPerSide,
        0,
      );

    let lo = minCubeSide;
    let hi = hiCap;
    if (
      totalIsoW(lo) >= horizontalIconBudget ||
      lo * heightPerSide >= verticalBudget
    ) {
      hi = Math.min(lo, verticalBudget / heightPerSide);
    } else {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (
          totalIsoW(mid) <= horizontalIconBudget &&
          mid * heightPerSide <= verticalBudget
        ) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }
    const maxSide = Math.floor(lo);
    const sides = sideRatios.map((r) =>
      Math.round(Math.max(minCubeSide, maxSide * r)),
    );
    const tallest = Math.max(...sides);

    return (
      <div
        className={cn("relative w-full select-none", className)}
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 6%, #fff), transparent)",
          borderRadius: 16,
          padding: whiteboard ? "20px 24px" : "14px 18px",
        }}
      >
        <div
          className="flex items-end justify-center"
          style={{
            gap: gapPx,
            paddingTop: labelPillH + labelGap + 4,
            paddingBottom: 0,
            borderBottom:
              "3px solid color-mix(in srgb, var(--foreground) 55%, transparent)",
            borderRadius: 2,
          }}
        >
          {items.map((item, idx) => {
            const side = sides[idx];
            const delay = 0.06 * idx;
            return (
              <CubeColumn
                key={item.key}
                item={item}
                side={side}
                tallest={tallest}
                labelPillH={labelPillH}
                labelGap={labelGap}
                delay={delay}
                whiteboard={whiteboard}
                axisWord={axisWord}
                withWater={isVolume}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (dimension === "area") {
    // ━━━ 面积布局：并排正方形（边长 ∝ √面积）━━━
    // 教学含义：让孩子直观看到"面积是边长的平方"——A 是 B 的 4 倍面积时，边长是 2 倍。
    const measureNumberW = whiteboard ? 0 : 0; // 数值放在正方形内部，不需额外列宽
    const labelPillH = whiteboard ? 30 : 26;
    const labelGap = 6;

    // 用 √ratio 决定正方形边长
    const sideRatios = ratios.map((r) => Math.sqrt(r));

    const minSquareSide = whiteboard ? 80 : 64;
    const verticalBudget = STAGE_INNER_HEIGHT - labelPillH - labelGap;
    const horizontalIconBudget =
      STAGE_INNER_WIDTH -
      Math.max(0, N - 1) * gapPx -
      N * measureNumberW;

    const totalSidesW = (m: number) =>
      sideRatios.reduce(
        (acc, r) => acc + Math.max(minSquareSide, m * r),
        0,
      );

    let lo = minSquareSide;
    let hi = whiteboard ? 260 : 200;
    if (totalSidesW(lo) >= horizontalIconBudget || lo >= verticalBudget) {
      hi = Math.min(lo, verticalBudget);
    } else {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (
          totalSidesW(mid) <= horizontalIconBudget &&
          mid <= verticalBudget
        ) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }
    const maxSide = Math.floor(lo);
    const sides = sideRatios.map((r) =>
      Math.round(Math.max(minSquareSide, maxSide * r)),
    );
    const tallest = Math.max(...sides);

    return (
      <div
        className={cn("relative w-full select-none", className)}
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 6%, #fff), transparent)",
          borderRadius: 16,
          padding: whiteboard ? "20px 24px" : "14px 18px",
        }}
      >
        <div
          className="flex items-end justify-center"
          style={{
            gap: gapPx,
            paddingTop: labelPillH + labelGap + 4,
            paddingBottom: 0,
            borderBottom:
              "3px solid color-mix(in srgb, var(--foreground) 55%, transparent)",
            borderRadius: 2,
          }}
        >
          {items.map((item, idx) => {
            const side = sides[idx];
            const delay = 0.06 * idx;
            return (
              <AreaSquareColumn
                key={item.key}
                item={item}
                side={side}
                tallest={tallest}
                labelPillH={labelPillH}
                labelGap={labelGap}
                delay={delay}
                whiteboard={whiteboard}
                axisWord={axisWord}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (targetAxis === "vertical") {
    // ━━━ 竖向布局（高度对比）━━━
    // 三个物品横向并排站在地面线上，标签 pill 在图标上方，测量线在图标右侧。
    // 反推 maxIconPx 同时受 width / height 双约束。
    const measureColW = whiteboard ? 92 : 76; // 右侧测量条 + 数值预留宽度
    const labelPillH = whiteboard ? 30 : 26;
    const labelGap = 6;
    const verticalBudget = STAGE_INNER_HEIGHT - labelPillH - labelGap;
    const horizontalIconBudget =
      STAGE_INNER_WIDTH - N * measureColW - Math.max(0, N - 1) * gapPx;

    // 严格线性：每列高度 = m × r（不加任何“最小宽度”兑底——那会破坏等比例）
    // 服务端已保证所有 ratio 在 1/3..1，即使最小项也是最大项的 1/3，视觉上仍可辨。
    const sumRatios = ratios.reduce((a, r) => a + r, 0);
    // 高度预算：高度轴上需要容纳“最高项”。列宽预算上需容纳总和。
    const maxIconPx = Math.min(
      STAGE_INNER_HEIGHT - measureLineH, // 最高项不能超出屏幕
      sumRatios > 0 ? horizontalIconBudget / sumRatios : 0, // 总宽不能超出屏幕
      whiteboard ? 320 : 260, // “越清晰越好”的上限
    );
    const iconSizesV = ratios.map((r) => Math.round(maxIconPx * r));
    const tallest = Math.max(...iconSizesV);

    return (
      <div
        className={cn("relative w-full select-none", className)}
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 6%, #fff), transparent)",
          borderRadius: 16,
          padding: whiteboard ? "20px 24px" : "14px 18px",
        }}
      >
        {/*
          地面线 = flex 容器的 border-bottom。
          这样地面线**物理贴在**图标底部，不会因父容器内边距错位而"漂浮"。
        */}
        <div
          className="flex items-end justify-center"
          style={{
            gap: gapPx,
            paddingTop: labelPillH + labelGap + 4,
            paddingBottom: 0,
            borderBottom:
              "3px solid color-mix(in srgb, var(--foreground) 55%, transparent)",
            borderRadius: 2,
          }}
        >
          {items.map((item, idx) => {
            const iconSize = iconSizesV[idx];
            const delay = 0.06 * idx;
            return (
              <VerticalColumn
                key={item.key}
                item={item}
                iconSize={iconSize}
                tallestIconSize={tallest}
                measureColW={measureColW}
                labelPillH={labelPillH}
                labelGap={labelGap}
                delay={delay}
                whiteboard={whiteboard}
                axisWord={axisWord}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ━━━ 横向布局（长度/宽度对比） ━━━
  // iconWidth_i = m × ratio_i = 测量线宽，等于物体真实主体宽度。
  // 每行高度按 PNG 主体 bbox 推算（真实主体宽高比），三行总高度填满舞台。
  const valueTextH = whiteboard ? 24 : 18;
  const valueGapH = whiteboard ? 26 : 20;
  const fixedH =
    N * (measureLineH + valueTextH + valueGapH) +
    Math.max(0, N - 1) * gapPx;
  const budgetForIcons = Math.max(80, STAGE_INNER_HEIGHT - fixedH);

  const maxRatioH = Math.max(...ratios);
  const availableIconW = Math.max(80, STAGE_INNER_WIDTH - labelW - 12);
  // 高度约束：sum(iconWidth_i / aspect_i) ≤ budget
  //          sum(m × ratio_i / aspect_i) ≤ budget
  //          m ≤ budget / sum(ratio_i / aspect_i)
  const sumWeightedH = ratios.reduce(
    (acc, r, i) => acc + r / Math.max(bodyAspects[i], 0.25),
    0,
  );
  const maxIconWidth = Math.min(
    sumWeightedH > 0 ? budgetForIcons / sumWeightedH : 0,
    maxRatioH > 0 ? availableIconW / maxRatioH : Number.POSITIVE_INFINITY,
    whiteboard ? 560 : 320,
  );
  const iconWidths = ratios.map((r) => Math.round(maxIconWidth * r));

  return (
    <div
      className={cn("relative w-full select-none", className)}
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 6%, #fff), transparent)",
        borderRadius: 16,
        padding: whiteboard ? "20px 24px" : "14px 18px",
      }}
    >
      <div className="flex flex-col" style={{ gap: gapPx }}>
        {items.map((item, idx) => {
          const iconWidth = iconWidths[idx];
          const bbox = itemBBoxes[idx];
          const aspect = Math.max(bodyAspects[idx], 0.25);
          const figureHeight = Math.max(20, Math.round(iconWidth / aspect));
          const rowHeight =
            figureHeight + measureLineH + valueTextH + valueGapH;
          const delay = 0.06 * idx;
          return (
            <div
              key={item.key}
              className="grid items-end"
              style={{
                gridTemplateColumns: `${labelW}px 1fr`,
                height: rowHeight,
                columnGap: 12,
              }}
            >
              <div
                className="flex justify-end items-center"
                style={{
                  height: rowHeight,
                  paddingBottom: measureLineH + valueTextH + valueGapH,
                }}
              >
                <ItemNamePill
                  item={item}
                  whiteboard={whiteboard}
                  axisWord={axisWord}
                />
              </div>
              <StretchedIcon
                iconifyId={item.iconifyId}
                iconWidth={iconWidth}
                figureHeight={figureHeight}
                bbox={bbox}
                isTarget={item.isTarget}
                delay={delay}
                sizeDisplay={item.sizeDisplay}
                whiteboard={whiteboard}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── 子组件 ───────────────────────── */

/**
 * 物体名彩色 pill
 */
function ItemNamePill({
  item,
  whiteboard,
  axisWord,
}: {
  item: CompareItem;
  whiteboard: boolean;
  /** "长度" / "高度" / "宽度"——根据当前比较轴向显示 */
  axisWord: string;
}) {
  return (
    <div
      className={cn(
        "px-2.5 py-1 rounded-lg font-display whitespace-nowrap",
        whiteboard ? "text-base" : "text-sm",
      )}
      style={{
        background: item.isTarget ? "var(--primary)" : "#fff",
        color: item.isTarget
          ? "#fff"
          : item.hainan
            ? "var(--teal-dark)"
            : "var(--foreground)",
        border: item.isTarget
          ? "2px solid var(--primary-dark)"
          : "2px solid var(--grey-200)",
        borderBottomWidth: item.isTarget ? 4 : 2,
      }}
    >
      {item.label}的{axisWord}
    </div>
  );
}

/**
 * 等比例放大的图标 + 教科书风格的测量标注线
 *
 *   ┌──────────┐
 *   │   图标    │
 *   └──────────┘
 *   │←  8 米  →│    ← 这一行是测量线：两端竖线 + 中间横线 + 数值
 *
 * 实现原理：
 *   - iconSize 由父组件按"标签最小宽度兜底 + 对数/线性映射"计算好直接传入。
 *   - 图标固定为正方形（保持原始 1:1 宽高比，绝不非匀拉伸）。
 *   - 测量线宽度 = 图标宽度，紧贴在图标下方，数值居中盖在横线上。
 *   - 入场 spring：scale 0 → 1（从左下角"长出"）。
 */
function StretchedIcon({
  iconifyId,
  iconWidth,
  figureHeight,
  bbox,
  isTarget,
  delay,
  sizeDisplay,
  whiteboard,
}: {
  iconifyId: string;
  /** 测量线宽 = 物体真实主体宽度 */
  iconWidth: number;
  /** 物体主体在画面上的实际像素高度（按 bbox 推算） */
  figureHeight: number;
  /** 物体在 PNG 中的不透明边界框（归一化 0~1） */
  bbox: AlphaBBox;
  isTarget: boolean;
  delay: number;
  sizeDisplay: string;
  whiteboard: boolean;
}) {
  const lineColor = isTarget ? "var(--primary-dark)" : "var(--foreground)";
  const lineStroke = isTarget ? 3 : 2.5;
  const capHeight = whiteboard ? 16 : 12;
  const valueGap = whiteboard ? 18 : 14;
  const lineGap = whiteboard ? 4 : 3;
  const measureWidth = iconWidth;
  const numberSizeCls = isTarget
    ? whiteboard
      ? "text-xl"
      : "text-base"
    : whiteboard
      ? "text-lg"
      : "text-sm";

  // 把整张 PNG 等比放大，使其 bbox 主体宽 = iconWidth；PNG 是方形，所以等比放大后 PNG 显示尺寸 = (iconWidth/bw) 见方
  const isPixel = iconifyId.startsWith("pixel-png:");
  const safeBw = Math.max(bbox.width, 0.05);
  const pngDisplaySize = isPixel ? Math.round(iconWidth / safeBw) : iconWidth;
  const pngOffsetX = isPixel ? -Math.round(pngDisplaySize * bbox.left) : 0;
  const pngOffsetY = isPixel ? -Math.round(pngDisplaySize * bbox.top) : 0;

  return (
    <div className="relative h-full flex items-start" style={{ minWidth: 0 }}>
      <motion.div
        className="flex flex-col items-stretch"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 14,
          mass: 0.9,
          delay,
          opacity: { duration: 0.2, delay },
        }}
        style={{
          width: iconWidth,
          height: "100%",
          transformOrigin: "0% 100%",
        }}
      >
        {/* 图形容器：iconWidth × figureHeight，主体 bbox 拉伸后裁剪显示 */}
        <motion.div
          animate={{ y: [0, isTarget ? -4 : -3, 0] }}
          transition={{
            duration: isTarget ? 2.4 : 3.0,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay + 0.4,
          }}
          style={{
            width: iconWidth,
            height: figureHeight,
            overflow: "hidden",
            position: "relative",
            lineHeight: 0,
            filter: isTarget
              ? "drop-shadow(0 4px 0 color-mix(in srgb, var(--primary-dark) 45%, transparent)) drop-shadow(0 0 12px color-mix(in srgb, var(--primary) 35%, transparent))"
              : "drop-shadow(0 3px 0 rgba(74,53,32,0.22)) drop-shadow(0 1px 0 rgba(255,255,255,0.55))",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: pngOffsetX,
              top: pngOffsetY,
              width: pngDisplaySize,
              height: pngDisplaySize,
              lineHeight: 0,
            }}
          >
            <SmartIcon iconifyId={iconifyId} size={pngDisplaySize} />
          </div>
        </motion.div>

        <div
          className="flex items-center"
          style={{
            width: measureWidth,
            height: capHeight,
            marginTop: valueGap,
            marginLeft: 0,
          }}
          aria-label={`长度 ${sizeDisplay}`}
        >
          {/* 左端竖线 */}
          <span
            style={{
              width: lineStroke,
              height: capHeight,
              background: lineColor,
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              height: lineStroke,
              background: lineColor,
              borderRadius: 1,
              minWidth: 4,
            }}
          />
          {/* 右端竖线 */}
          <span
            style={{
              width: lineStroke,
              height: capHeight,
              background: lineColor,
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
        </div>
        <div
          className={cn(
            "font-display font-bold whitespace-nowrap text-center",
            numberSizeCls,
          )}
          style={{
            width: measureWidth,
            marginTop: lineGap,
            color: isTarget ? "var(--primary-dark)" : "var(--foreground)",
            lineHeight: 1,
            overflow: "visible",
          }}
        >
          {sizeDisplay}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * 面积比较的"正方形列"
 *
 *   ┌──────────┐
 *   │ 课桌的面积 │  ← 标签 pill 浮在正方形上方
 *   └──────────┘
 *      ┌──────────┐
 *      │   🪑    │  ← 图标在正方形中心
 *      │          │
 *      │  0.4 m²  │  ← 数值贴在正方形右下
 *      └──────────┘
 *  ──────────────── ← 共享地面线
 *
 * 教学要点：边长 ∝ √面积——孩子直观感受"4 倍面积 = 2 倍边长"。
 */
function AreaSquareColumn({
  item,
  side,
  tallest,
  labelPillH,
  labelGap,
  delay,
  whiteboard,
  axisWord,
}: {
  item: CompareItem;
  side: number;
  tallest: number;
  labelPillH: number;
  labelGap: number;
  delay: number;
  whiteboard: boolean;
  axisWord: string;
}) {
  const isTarget = item.isTarget;
  const fillBg = isTarget
    ? "color-mix(in srgb, var(--primary) 30%, #fff)"
    : "color-mix(in srgb, var(--accent, #B8E0F2) 22%, #fff)";
  const borderColor = isTarget
    ? "var(--primary-dark)"
    : "color-mix(in srgb, var(--foreground) 35%, transparent)";

  const numberSize = isTarget ? (whiteboard ? 18 : 14) : whiteboard ? 16 : 13;
  const valueGap = whiteboard ? 8 : 6;
  const columnTotalH = tallest + labelPillH + labelGap + numberSize + valueGap;

  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{ height: columnTotalH, flexShrink: 0 }}
    >
      {/* 标签 pill */}
      <div
        style={{
          position: "absolute",
          bottom: side + numberSize + valueGap + labelGap,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ItemNamePill
          item={item}
          whiteboard={whiteboard}
          axisWord={axisWord}
        />
      </div>

      {/* 正方形：填充色 + 边框 + 居中图标 */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 14,
          mass: 0.9,
          delay,
          opacity: { duration: 0.2, delay },
        }}
        style={{
          width: side,
          height: side,
          background: fillBg,
          border: `${isTarget ? 3 : 2}px solid ${borderColor}`,
          borderRadius: 12,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isTarget
            ? "0 4px 0 color-mix(in srgb, var(--primary-dark) 35%, transparent)"
            : "0 3px 0 rgba(74,53,32,0.18)",
          transformOrigin: "50% 100%",
        }}
        aria-label={`${item.label} ${item.sizeDisplay}`}
      >
        {/* 图标铺满正方形（留 6% 边距给边框呼吸感） */}
        <div
          style={{
            width: side * 0.88,
            height: side * 0.88,
            lineHeight: 0,
          }}
        >
          <SmartIcon iconifyId={item.iconifyId} size={side * 0.88} />
        </div>
      </motion.div>
      <div
        className="font-display font-bold whitespace-nowrap text-center"
        style={{
          width: side,
          marginTop: valueGap,
          fontSize: numberSize,
          color: isTarget ? "var(--primary-dark)" : "var(--foreground)",
          lineHeight: 1,
          overflow: "visible",
        }}
      >
        {item.sizeDisplay}
      </div>
    </div>
  );
}

/**
 * 重量/时间比较的"横向条"
 *
 *   [图标] 一个苹果    ████████░░░░░░░░░  200 克
 *   [图标] 一个西瓜    ████████████████░  5 千克
 *
 * 教学要点：条长 ∝ 数值（线性）——孩子看到"3 倍 = 条长 3 倍"。
 * `accent=true`（重量）用橙红色；`accent=false`（时间）用金黄色。
 */
function BarRow({
  item,
  ratio,
  delay,
  rowH,
  iconColW,
  labelColW,
  numberColW,
  barAreaW,
  whiteboard,
  accent,
}: {
  item: CompareItem;
  ratio: number;
  delay: number;
  rowH: number;
  iconColW: number;
  labelColW: number;
  numberColW: number;
  barAreaW: number;
  whiteboard: boolean;
  accent: boolean;
}) {
  const isTarget = item.isTarget;
  const barW = Math.max(8, Math.round(barAreaW * ratio));
  // 重量：暖橙红；时间：暖金黄
  const barColor = isTarget
    ? "var(--primary)"
    : accent
      ? "#F59E63"
      : "#F4C43C";
  const barColorDark = isTarget
    ? "var(--primary-dark)"
    : accent
      ? "#C26430"
      : "#B6862A";
  const labelFont = whiteboard ? 18 : 15;
  const numberFont = whiteboard ? 18 : 14;
  const iconSize = Math.min(rowH - 8, whiteboard ? 56 : 44);

  return (
    <div
      className="flex items-center"
      style={{
        height: rowH,
        gap: 10,
        background: isTarget
          ? "color-mix(in srgb, var(--primary) 10%, #fff)"
          : "transparent",
        borderRadius: 12,
        padding: "0 6px",
        border: isTarget
          ? "2px solid color-mix(in srgb, var(--primary) 40%, transparent)"
          : "2px solid transparent",
      }}
    >
      {/* 图标列 */}
      <div
        style={{
          width: iconColW,
          height: rowH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <SmartIcon iconifyId={item.iconifyId} size={iconSize} />
      </div>

      {/* 标签列 */}
      <div
        className="font-display whitespace-nowrap overflow-hidden text-ellipsis"
        style={{
          width: labelColW,
          fontSize: labelFont,
          color: isTarget ? "var(--primary-dark)" : "var(--foreground)",
          fontWeight: isTarget ? 700 : 500,
          flexShrink: 0,
        }}
      >
        {item.label}
        {isTarget && (
          <span
            style={{
              marginLeft: 6,
              fontSize: labelFont - 3,
              color: "var(--primary-dark)",
              background: "color-mix(in srgb, var(--primary) 20%, #fff)",
              padding: "2px 6px",
              borderRadius: 8,
              verticalAlign: "middle",
            }}
          >
            你说的
          </span>
        )}
      </div>

      {/* 条形列：动画从 0 拉伸到 barW */}
      <div
        style={{
          flex: 1,
          height: rowH - 14,
          display: "flex",
          alignItems: "center",
          minWidth: 40,
        }}
      >
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: barW, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 160,
            damping: 18,
            mass: 0.9,
            delay,
            opacity: { duration: 0.2, delay },
          }}
          style={{
            height: "100%",
            background: `linear-gradient(180deg, ${barColor}, ${barColorDark})`,
            borderRadius: 999,
            boxShadow: `0 3px 0 ${barColorDark}`,
            border: `2px solid ${barColorDark}`,
          }}
        />
      </div>

      {/* 数值列 */}
      <div
        className="font-display font-bold whitespace-nowrap"
        style={{
          width: numberColW,
          fontSize: numberFont,
          color: isTarget ? "var(--primary-dark)" : "var(--foreground)",
          textAlign: "right",
          flexShrink: 0,
          paddingRight: 4,
        }}
      >
        {item.sizeDisplay}
      </div>
    </div>
  );
}

/**
 * 重量比较的"天平"动画
 *
 *           [🍎]            [🍉]            ← 两物从空中掉到秤盘上
 *            │              │
 *           ╔═╗            ╔═╗
 *           ╚═╝════════════╚═╝              ← 横梁按 log2(质量比) 倾斜
 *                   │
 *                  ╱│╲                       ← 三角支点
 *               ─────────                    ← 木台底座
 *           你的:苹果 200克   西瓜 5千克       ← 标签固定（不随梁倾斜）
 *
 * 教学含义：孩子能直观看见"哪边沉"——重的一端往下压。
 * 倾角公式：angle = clamp(-log2(left/right) × 6, ±16°)。
 * 原因：log 让"差 100 倍"的极端比例也只到 ±13°，物体不会滑出秤盘。
 *      负号是因为 CSS rotate 顺时针为正，而我们要让"重者往下"，
 *      左重 → 左下 → 逆时针 → 负角度。
 */
/**
 * —— 天平素材资源约定 ——
 *
 * 三张 PNG 都放在 /public 下（用户已上传）：
 *   - /scale-Base.png  底座 + 立柱 + 支点（顶部正中即支点尖）
 *   - /scale-beam.png  横梁（左右严格镜像，几何正中即旋转支点）
 *   - /scale-pan.png   秤盘 + 吊绳（顶部正中是挂点，吊绳占图上半部分）
 *
 * ASPECT 是"宽 / 高"——按出图提示词里的建议规格 baked-in。如果实际素材
 * 比例不一致，**改这里就行**（视觉会自动重新对齐，不用动布局逻辑）。
 *
 * PAN_DISH_TOP_RATIO：秤盘图里"碟身顶部"占整图竖直方向的比例。物体掉落
 * 时落在 ropePortion 之下、贴在碟身上沿。比如出图里绳子约占 55%、碟身
 * 约占 45%，PAN_DISH_TOP_RATIO ≈ 0.55。觉得物体落得太低/太高就微调这个数。
 */
const SCALE_ASSETS = {
  // aspect = 真实素材的 宽 / 高（用 PowerShell 量过，prompt 建议规格不算数）。
  // 换素材后必须同步更新这里，否则图会被拉扁/拉长。
  base: { src: "/scale-Base.png", aspect: 212 / 245 }, // 0.865，竖长方形
  beam: { src: "/scale-beam.png", aspect: 430 / 61 }, // 7.05
  pan: { src: "/scale-pan.png", aspect: 188 / 245 }, // 0.767，竖长方形
} as const;

/* ════════════════════════════════════════════════════════════════════════
   天平整体大小 + 各部件微调旋钮
   ────────────────────────────────────────────────────────────────────────
   素材是 AI 出的 PNG，三张图各自的"画面留白 / 锚点位置"不一定和我代码假设
   的一致（理想：底座支点在顶部正中、横梁旋转点在图正中底边、秤盘挂点在
   顶部正中）。下面这些常量就是给你**目测调位**用的——不要去改下面的布局
   代码，只调这里就够了。

   ── 调整顺序建议 ──
   1) SCALE_SIZE：先把整体放到合适大小
   2) BEAM_NUDGE：让横梁中点正好落在底座支点尖上
   3) PAN_NUDGE：让秤盘的挂钩对齐横梁两端
   4) ITEM_NUDGE：让物体（苹果/西瓜）正好坐在秤盘碟面上
   ════════════════════════════════════════════════════════════════════════ */

/** 整体缩放系数。1 = 默认；想更大就调 1.3 / 1.5 / 1.8。
 *  ⚠️ 之前 base PNG 顶部有大留白，需要 SCALE_SIZE=3 撑大。新图已 trim，
 *     1.5~2 就足够；调大反而把底座顶得过高。 */
const SCALE_SIZE = 1.6;

/** 物体落点：秤盘图竖直方向多少处算"碟面顶部"。
 *  绳子+秤盘整张图，绳子约占 55% → 0.55；物体显得太低就调小，太高就调大。 */
const PAN_DISH_TOP_RATIO = 0.5;

/** 横梁两端"挂钩"距端点的水平比例。素材挂钩越靠内 → 调大；越靠外 → 调小。 */
const BEAM_HOOK_INSET_RATIO = 0.06;

/** 各组件像素级微调（正值 = 向右/向下，负值 = 向左/向上）。
 *  按渲染后的显示像素算，已经经过 SCALE_SIZE 缩放，调这里直接看效果。
 *  ⚠️ 三张 PNG 都 trim 干净后，理论上全部 0 就能对位；偏移大说明素材
 *     里还有透明留白，可优先重新 trim 而不是一直靠 NUDGE 补偿。 */
const BASE_NUDGE = { x: 0, y: -58 };
/** 横梁的微调：让横梁底边精确"骑在"底座支点尖上。 */
const BEAM_NUDGE = { x: 0, y: 0 };
/** 秤盘的微调：素材挂点不在图片正中或顶端时用。 */
const PAN_NUDGE = { x: 0, y: -78 };
/** 物体（苹果等）的微调：让它正好坐在碟面上。 */
const ITEM_NUDGE = { x: 0, y: 90 };
/** 物体（苹果/西瓜等）大小的额外放大倍数。1 = 跟随 SCALE_SIZE；调 1.5
 *  就让物体在秤盘上看起来更大。**不会**改变天平本身大小。 */
const ITEM_SIZE_FACTOR = 1.4;

/** 整个天平绘图区的高度（px）。null = 按各部件高度自动加总。
 *  素材已 trim 干净时建议用 null（让布局紧凑）；如果还有留白可以手动锁。 */
const STAGE_HEIGHT_OVERRIDE: number | null = null;

/** 底部物品标签（"西瓜 5 千克" / "猫 4 千克"）的字号 / 位置。
 *  - LABEL_NAME_FONT：物品名（"西瓜"）的字号 px
 *  - LABEL_SIZE_FONT：数值（"5 千克"）的字号 px
 *  - LABEL_BLOCK_H：标签整块占用的高度（影响标签和秤盘之间的距离，越大越远）
 *  - LABEL_NUDGE：整体微调（正值 = 右/下） */
const LABEL_NAME_FONT = 28;
const LABEL_SIZE_FONT = 30;
const LABEL_BLOCK_H = 60;
const LABEL_NUDGE = { x: 0, y: -270 };

/** 天平最大倾斜角度（°）。视觉上太小看不出谁重，太大物体会"飞出去"。
 *  16 = 老的保守值；25~30 在新的"秤盘跟着横梁一起转"的布局下也安全。 */
const TILT_MAX_DEG = 28;
/** 倾斜灵敏度：tiltAngle = -log2(left/right) × TILT_GAIN。
 *  6 = 老的保守值；10 让 2~4 倍的差距也能明显倾斜。 */
const TILT_GAIN = 11;

function BalanceScale({
  left,
  right,
  width,
  height: _height,
  whiteboard,
  delay = 0,
}: {
  left: CompareItem;
  right: CompareItem;
  width: number;
  height: number;
  whiteboard: boolean;
  delay?: number;
}) {
  const safeRatio = Math.max(left.size / Math.max(right.size, 1e-9), 1e-6);
  const log = Math.log2(safeRatio);
  // CSS rotate 正值=顺时针 → 左侧上抬；我们要"重者下沉"，所以取负
  const tiltAngle = Math.max(
    -TILT_MAX_DEG,
    Math.min(TILT_MAX_DEG, -log * TILT_GAIN),
  );

  // ── 各部件显示尺寸（白板/普通两套），最后乘 SCALE_SIZE 全局放大 ──
  // 底座（含立柱+支点）整体作为一张图，占主舞台底部
  const baseW = (whiteboard ? 280 : 220) * SCALE_SIZE;
  const baseH = baseW / SCALE_ASSETS.base.aspect;

  // 横梁尺寸：根据可用宽度算，留一点 padding 防超出。
  // 仍要受 width 约束，避免超出舞台被裁掉。
  const beamLenIdeal = (whiteboard ? 460 : 360) * SCALE_SIZE;
  const beamLen = Math.min(width - (whiteboard ? 60 : 48), beamLenIdeal);
  const beamH = beamLen / SCALE_ASSETS.beam.aspect;

  // 秤盘
  const panW = (whiteboard ? 130 : 100) * SCALE_SIZE;
  const panH = panW / SCALE_ASSETS.pan.aspect;

  const itemSize = (whiteboard ? 78 : 60) * SCALE_SIZE * ITEM_SIZE_FACTOR;
  // 标签字号 / 高度走顶部常量；不再随 whiteboard 区分（用户自己调）
  const labelFont = LABEL_NAME_FONT;
  const sizeFont = LABEL_SIZE_FONT;
  const labelBlockH = LABEL_BLOCK_H;

  // 物体落点：贴秤盘碟面上沿（碟面 = pan 图竖直方向 PAN_DISH_TOP_RATIO 之后）
  const panDishTop = panH * PAN_DISH_TOP_RATIO;

  // 横梁旋转后两端挂点的水平位置（相对横梁左端）
  const hookOffsetFromEnd = beamLen * BEAM_HOOK_INSET_RATIO;

  // 整体绘图区高度。
  // ⚠️ 易错点：秤盘是从横梁往下挂的，**不**占顶部高度——所以不能把
  //    panH 和 itemSize 加进来（之前这么写多算 400+px 顶部空白）。
  //    可见内容范围 = 底座 + 横梁 + 横梁倾斜上扬的余量。
  //    ──── 横梁最大倾斜 ±16°，高的一端会比横梁中点抬高 ~sin(16°) × beamLen/2
  const tiltHeadroom = Math.ceil(
    (beamLen / 2) * Math.sin((16 * Math.PI) / 180),
  );
  const stageH =
    STAGE_HEIGHT_OVERRIDE ?? baseH + beamH + tiltHeadroom + 12;

  const dropLeftDelay = delay + 0.2;
  const dropRightDelay = delay + 0.55;
  const tiltDelay = delay + 1.05;

  /**
   * 单侧秤盘 = 图片秤盘 + 中央落物。
   *
   * 锚点逻辑：把这个 div 的"顶部正中"对齐到横梁端点的挂钩位置。父容器
   * （旋转的横梁）已经把我们摆到挂钩 (x, beam-top)，这里再用
   * `transform: translate(-50%, 0)` 让秤盘图水平居中、垂直从挂点向下生长。
   */
  function Pan({
    item,
    dropDelay,
    side,
  }: {
    item: CompareItem;
    dropDelay: number;
    side: "left" | "right";
  }) {
    return (
      <div
        style={{
          position: "absolute",
          top: PAN_NUDGE.y,
          left:
            (side === "left" ? hookOffsetFromEnd : beamLen - hookOffsetFromEnd) +
            (side === "left" ? PAN_NUDGE.x : -PAN_NUDGE.x),
          transform: "translate(-50%, 0)",
          width: panW,
          height: panH + itemSize, // 留出物体下落覆盖区
        }}
      >
        {/* 秤盘 + 吊绳整张图 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAsset(SCALE_ASSETS.pan.src)}
          alt=""
          width={panW}
          height={panH}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: panW,
            height: panH,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            filter: "drop-shadow(0 2px 3px rgba(74,53,32,0.18))",
          }}
          draggable={false}
        />
        {/* 物体从空中落入秤盘碟面 */}
        <motion.div
          initial={{ y: -180, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            y: {
              type: "spring",
              stiffness: 220,
              damping: 14,
              mass: 0.7,
              delay: dropDelay,
            },
            opacity: { duration: 0.18, delay: dropDelay },
          }}
          style={{
            position: "absolute",
            top: panDishTop - itemSize + 4 + ITEM_NUDGE.y,
            left: (panW - itemSize) / 2 + ITEM_NUDGE.x,
            width: itemSize,
            height: itemSize,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            lineHeight: 0,
          }}
          aria-label={`${item.label} ${item.sizeDisplay}`}
        >
          <SmartIcon iconifyId={item.iconifyId} size={itemSize} bottomAlign />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width, paddingBottom: labelBlockH }}>
      <div style={{ position: "relative", width, height: stageH }}>
        {/* 底座 + 立柱 + 支点（整张图）。支点尖在图片顶部正中。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAsset(SCALE_ASSETS.base.src)}
          alt=""
          width={baseW}
          height={baseH}
          style={{
            position: "absolute",
            bottom: -BASE_NUDGE.y,
            left: `calc(50% + ${BASE_NUDGE.x}px)`,
            transform: "translateX(-50%)",
            width: baseW,
            height: baseH,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            filter: "drop-shadow(0 4px 6px rgba(74,53,32,0.22))",
          }}
          draggable={false}
        />
        {/* 横梁组（围支点旋转）+ 两个秤盘
            旋转中心 = 横梁图的水平正中、底部（top + beamH 处），刚好落在
            底座图的顶部正中（支点尖）。
            transformOrigin "50% 100%" = 横梁底边正中。 */}
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: tiltAngle }}
          transition={{
            type: "spring",
            stiffness: 70,
            damping: 11,
            mass: 1.1,
            delay: tiltDelay,
          }}
          style={{
            position: "absolute",
            // 横梁底贴在底座顶。支点高度 = baseH（底座顶端）；BEAM_NUDGE.y 正值往下
            bottom: baseH - BEAM_NUDGE.y,
            left: `calc(50% + ${BEAM_NUDGE.x}px)`,
            marginLeft: -beamLen / 2,
            width: beamLen,
            height: beamH,
            transformOrigin: "50% 100%",
          }}
        >
          {/* 横梁图 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAsset(SCALE_ASSETS.beam.src)}
            alt=""
            width={beamLen}
            height={beamH}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: beamLen,
              height: beamH,
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
              filter: "drop-shadow(0 2px 3px rgba(74,53,32,0.18))",
            }}
            draggable={false}
          />
          {/* 秤盘锚点容器：用 top: beamH 让秤盘从横梁底端向下挂 */}
          <div
            style={{
              position: "absolute",
              top: beamH,
              left: 0,
              width: beamLen,
              height: 0,
            }}
          >
            <Pan item={left} side="left" dropDelay={dropLeftDelay} />
            <Pan item={right} side="right" dropDelay={dropRightDelay} />
          </div>
        </motion.div>
      </div>
      {/* 标签行：固定不随横梁倾斜，水平对齐到两个秤盘正下方 */}
      <div
        style={{
          position: "absolute",
          left: LABEL_NUDGE.x,
          right: -LABEL_NUDGE.x,
          bottom: -LABEL_NUDGE.y,
          display: "flex",
          justifyContent: "space-between",
          padding: `0 ${(width - beamLen) / 2 - panW / 2}px`,
        }}
      >
        {[left, right].map((it, i) => (
          <div
            key={i}
            style={{
              width: panW + 24,
              textAlign: "center",
              color: it.isTarget
                ? "var(--primary-dark)"
                : "var(--foreground)",
              lineHeight: 1.15,
            }}
          >
            <div
              className="font-display whitespace-nowrap overflow-hidden text-ellipsis"
              style={{
                fontSize: labelFont,
                fontWeight: it.isTarget ? 700 : 500,
              }}
            >
              {it.label}
              {it.isTarget && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: labelFont - 3,
                    color: "var(--primary-dark)",
                    background:
                      "color-mix(in srgb, var(--primary) 22%, #fff)",
                    padding: "1px 5px",
                    borderRadius: 6,
                  }}
                >
                  你的
                </span>
              )}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: sizeFont,
                fontWeight: 700,
                marginTop: 1,
              }}
            >
              {it.sizeDisplay}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 体积/容积比较的"立方体列"
 *
 *      ┌──────┐
 *      │ 课桌 │  ← 标签 pill 浮在立方体顶部上方
 *      └──────┘
 *           ╱│
 *         ╱  │     ← 等距投影：顶面 + 右侧面 + 正面
 *      ┌──┐  │
 *      │图├──┤
 *      │标│  │
 *      └──┴──┘
 *  ──────────────  ← 共享地面线
 *
 * 教学要点：棱长 ∝ ∛size——孩子看到"8 倍体积 = 2 倍棱长，27 倍体积 = 3 倍棱长"。
 * `withWater=true` 时（容积模式）会**完全替换**为 BeakerColumn（烧杯+液体波浪）。
 */

/* ════════════════════════════════════════════════════════════════════════
   烧杯素材（容积模式专用）调参
   素材：/public/beaker.png（实测 1612 × 2164）
   ════════════════════════════════════════════════════════════════════════ */
const BEAKER_ASSET = {
  src: "/beaker.png",
  aspect: 1612 / 2164, // ≈ 0.745，竖长方形
};
/** 烧杯**内壁**的范围占整张图的比例（上 / 右 / 下 / 左 padding 占比）。
 *  AI 出的图四周一般有玻璃厚度 + 留白，水面要在内壁里晃才不穿帮。
 *  眼测调整：让蓝色水面正好"卡"在玻璃内沿。 */
const BEAKER_INNER_INSET = {
  top: 0.06, // 顶口下方留白比例（敞口 + 玻璃唇）
  right: 0.15, // 右壁玻璃厚度
  bottom: 0.08, // 底壁玻璃厚度
  left: 0.08, // 左壁玻璃厚度
};
/** 水位高度占内壁高度的比例。0.88 = 装得很满露一点空气；可调 0.7~0.95 */
const BEAKER_WATER_RATIO = 0.98;
/** 物品图标在烧杯内的尺寸 / 位置（相对烧杯内壁宽度）。 */
const BEAKER_ICON_SIZE_RATIO = 0.8;
const BEAKER_ICON_TOP_RATIO = 0.38; // 图标顶距内壁顶部多少（占内壁高度比例）

/**
 * 容积模式的"烧杯列"——替代立方体。
 * 教学含义：装液体的容器，水面波浪暗示"装得满满的液体体积"。
 * 尺寸缩放：烧杯高度仍走立方根（side ∝ ∛size），保证 8 倍体积 → 2 倍棱长这个核心规则。
 */
function BeakerColumn({
  item,
  side,
  tallest,
  labelPillH,
  labelGap,
  delay,
  whiteboard,
  axisWord,
}: {
  item: CompareItem;
  side: number;
  tallest: number;
  labelPillH: number;
  labelGap: number;
  delay: number;
  whiteboard: boolean;
  axisWord: string;
}) {
  const isTarget = item.isTarget;
  // 烧杯的视觉高度对齐立方体列高（columnH = side + isoSkew*0.55 = side*1.22）
  const beakerH = side * 1.22;
  const beakerW = beakerH * BEAKER_ASSET.aspect;
  // 整列宽度：留点空间给 label pill；用 beakerW 作为基准
  const columnW = beakerW;
  const columnH = beakerH;

  // 对齐"最高列"使所有列底端齐平
  const tallestColumnH = tallest * 1.22;
  const numberSize = isTarget ? (whiteboard ? 18 : 14) : whiteboard ? 16 : 13;
  const valueGap = whiteboard ? 8 : 6;
  const totalH = tallestColumnH + labelPillH + labelGap + numberSize + valueGap;

  // 烧杯内壁矩形（在 beaker 容器内的绝对像素）
  const innerLeft = beakerW * BEAKER_INNER_INSET.left;
  const innerRight = beakerW * (1 - BEAKER_INNER_INSET.right);
  const innerTop = beakerH * BEAKER_INNER_INSET.top;
  const innerBottom = beakerH * (1 - BEAKER_INNER_INSET.bottom);
  const innerW = innerRight - innerLeft;
  const innerH = innerBottom - innerTop;

  // 水位顶部：从内壁底向上 BEAKER_WATER_RATIO 高度
  const waterTop = innerBottom - innerH * BEAKER_WATER_RATIO;
  const waterH = innerBottom - waterTop;

  // 图标
  const iconBoxSize = innerW * BEAKER_ICON_SIZE_RATIO;
  const iconLeft = innerLeft + (innerW - iconBoxSize) / 2;
  const iconTop = innerTop + innerH * BEAKER_ICON_TOP_RATIO;

  // 波浪相位（hash item label，跟立方体水版同一套逻辑，但写在这里方便独立调）
  let h = 0;
  for (let i = 0; i < item.label.length; i++) {
    h = (h * 31 + item.label.charCodeAt(i)) >>> 0;
  }
  const phaseSlow = -((h % 500) / 100);
  const phaseFast = -(((h >>> 3) % 400) / 100);
  const slowDur = 4.5 + (h % 21) / 10;
  const fastDur = 3.5 + ((h >>> 5) % 17) / 10;

  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{ height: totalH, flexShrink: 0 }}
    >
      {/* 标签 pill */}
      <div
        style={{
          position: "absolute",
          bottom: columnH + numberSize + valueGap + labelGap,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ItemNamePill
          item={item}
          whiteboard={whiteboard}
          axisWord={axisWord}
        />
      </div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 14,
          mass: 0.9,
          delay,
          opacity: { duration: 0.2, delay },
        }}
        style={{
          width: beakerW,
          height: beakerH,
          position: "relative",
          transformOrigin: "50% 100%",
        }}
        aria-label={`${item.label} ${item.sizeDisplay}`}
      >
        {/* 烧杯玻璃图（最底层）：先画杯子。AI 出的 PNG 玻璃壁有非零填充，
            如果把水放底层会被烧杯整个盖掉（实测）→ 改成水覆盖在烧杯上面，
            内 inset 限制水在玻璃内部，物理上还是"水在杯子里"的语义。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAsset(BEAKER_ASSET.src)}
          alt=""
          width={beakerW}
          height={beakerH}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: beakerW,
            height: beakerH,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            filter: isTarget
              ? "drop-shadow(0 4px 6px rgba(74,53,32,0.18))"
              : "drop-shadow(0 3px 4px rgba(74,53,32,0.12))",
          }}
          draggable={false}
        />

        {/* 水位波浪层（中层）：盖在烧杯上面，但严格 clip 在内壁矩形里。
            mix-blend-mode: multiply 让水跟玻璃壁颜色叠加而不是完全遮盖
            → 玻璃边缘的描边/反光仍能透出来，更像"玻璃中的水"。 */}
        <div
          className="liquid-wave-container"
          style={{
            position: "absolute",
            left: innerLeft,
            top: waterTop,
            width: innerW,
            height: waterH,
            overflow: "hidden",
            pointerEvents: "none",
            mixBlendMode: "screen",
            ["--wave-slow-dur" as string]: `${slowDur}s`,
            ["--wave-fast-dur" as string]: `${fastDur}s`,
            ["--wave-slow-delay" as string]: `${phaseSlow}s`,
            ["--wave-fast-delay" as string]: `${phaseFast}s`,
          }}
        >
          <style>{`
            @keyframes liquidWaveCW {
              0%   { transform: translateX(-25%) rotate(0deg); }
              100% { transform: translateX(-25%) rotate(360deg); }
            }
            @keyframes liquidWaveCCW {
              0%   { transform: translateX(-25%) rotate(0deg); }
              100% { transform: translateX(-25%) rotate(-360deg); }
            }
            .liquid-wave-container .wave-slow {
              animation: liquidWaveCW var(--wave-slow-dur, 5s) linear infinite;
              animation-delay: var(--wave-slow-delay, 0s);
            }
            .liquid-wave-container .wave-fast {
              animation: liquidWaveCCW var(--wave-fast-dur, 4s) linear infinite;
              animation-delay: var(--wave-fast-delay, 0s);
            }
          `}</style>
          <div
            className="wave-slow"
            style={{
              position: "absolute",
              left: 0,
              width: "200%",
              height: "200%",
              top: "12%",
              background: "#4FB6E6",
              opacity: 0.90,
              borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
            }}
          />
          <div
            className="wave-fast"
            style={{
              position: "absolute",
              left: 0,
              width: "200%",
              height: "200%",
              top: "16%",
              background: "#0e79aa",
              opacity: 1,
              borderRadius: "60% 40% 30% 70% / 50% 60% 50% 40%",
            }}
          />
        </div>

        {/* 物品图标（顶层）：盖在水之上 */}
        <div
          style={{
            position: "absolute",
            left: iconLeft,
            top: iconTop,
            width: iconBoxSize,
            height: iconBoxSize,
            lineHeight: 0,
            pointerEvents: "none",
          }}
        >
          <SmartIcon iconifyId={item.iconifyId} size={iconBoxSize} />
        </div>
      </motion.div>

      <div
        className="font-display font-bold whitespace-nowrap text-center"
        style={{
          width: columnW,
          marginTop: valueGap,
          fontSize: numberSize,
          color: isTarget ? "var(--primary-dark)" : "var(--foreground)",
          lineHeight: 1,
          overflow: "visible",
        }}
      >
        {item.sizeDisplay}
      </div>
    </div>
  );
}

function CubeColumn({
  item,
  side,
  tallest,
  labelPillH,
  labelGap,
  delay,
  whiteboard,
  axisWord,
  withWater,
}: {
  item: CompareItem;
  side: number;
  tallest: number;
  labelPillH: number;
  labelGap: number;
  delay: number;
  whiteboard: boolean;
  axisWord: string;
  withWater: boolean;
}) {
  // 容积模式整体改用烧杯渲染，立方体只服务"体积"维度。
  if (withWater) {
    return (
      <BeakerColumn
        item={item}
        side={side}
        tallest={tallest}
        labelPillH={labelPillH}
        labelGap={labelGap}
        delay={delay}
        whiteboard={whiteboard}
        axisWord={axisWord}
      />
    );
  }
  const isTarget = item.isTarget;
  // 等距投影：30° 侧斜
  const isoSkew = 0.4 * side; // 顶面/侧面斜偏量
  // 整列总宽 = 正面 + 顶面斜偏；总高 = 正面高 + 顶面斜偏
  const columnW = side + isoSkew;
  const columnH = side + isoSkew * 0.55;

  // 整列对齐"最高立方体"的总高，所以矮立方体的视觉底也跟地面线齐平
  const tallestColumnH = tallest + 0.4 * tallest * 0.55;
  const numberSize = isTarget ? (whiteboard ? 18 : 14) : whiteboard ? 16 : 13;
  const valueGap = whiteboard ? 8 : 6;
  const totalH = tallestColumnH + labelPillH + labelGap + numberSize + valueGap;

  const front = isTarget
    ? "color-mix(in srgb, var(--primary) 35%, #fff)"
    : "color-mix(in srgb, var(--accent, #B8E0F2) 28%, #fff)";
  const top = isTarget
    ? "color-mix(in srgb, var(--primary) 55%, #fff)"
    : "color-mix(in srgb, var(--accent, #B8E0F2) 45%, #fff)";
  const right = isTarget
    ? "color-mix(in srgb, var(--primary) 25%, #000 8%)"
    : "color-mix(in srgb, var(--accent, #B8E0F2) 18%, #000 8%)";
  const stroke = isTarget ? "var(--primary-dark)" : "rgba(74,53,32,0.55)";
  const strokeW = isTarget ? 2.5 : 2;

  // 绘制坐标参考点（SVG viewBox = columnW × columnH）：
  //   正面左上 = (0, isoSkew*0.55)
  //   正面右下 = (side, columnH)
  //   顶面四角：左下 = 正面左上, 右下 = 正面右上(side, isoSkew*0.55), 右上 = (columnW, 0), 左上 = (isoSkew, 0)
  //   右侧面：上左 = 正面右上, 上右 = (columnW, 0), 下右 = (columnW, side*0.55+...), 下左 = 正面右下
  const skewY = isoSkew * 0.55;
  const fxL = 0,
    fxR = side,
    fyT = skewY,
    fyB = columnH;
  const tL = [0, skewY] as const;
  const tR = [side, skewY] as const;
  const tTR = [columnW, 0] as const;
  const tTL = [isoSkew, 0] as const;
  const sUL = tR;
  const sUR = tTR;
  const sLR = [columnW, columnH - skewY] as const;
  const sLL = [side, columnH] as const;

  const pathPolyTop = `M ${tL[0]} ${tL[1]} L ${tR[0]} ${tR[1]} L ${tTR[0]} ${tTR[1]} L ${tTL[0]} ${tTL[1]} Z`;
  const pathPolyRight = `M ${sUL[0]} ${sUL[1]} L ${sUR[0]} ${sUR[1]} L ${sLR[0]} ${sLR[1]} L ${sLL[0]} ${sLL[1]} Z`;

  // 体积模式：图标铺满正面（容积模式已在上面 if 分支走 BeakerColumn）
  const iconBoxSize = side * 0.92;
  const iconLeft = (fxR - iconBoxSize) / 2;
  const iconTop = fyT + (side - iconBoxSize) / 2;

  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{ height: totalH, flexShrink: 0 }}
    >
      {/* 标签 pill：浮在立方体顶部 */}
      <div
        style={{
          position: "absolute",
          bottom: columnH + numberSize + valueGap + labelGap,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ItemNamePill
          item={item}
          whiteboard={whiteboard}
          axisWord={axisWord}
        />
      </div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 14,
          mass: 0.9,
          delay,
          opacity: { duration: 0.2, delay },
        }}
        style={{
          width: columnW,
          height: columnH,
          position: "relative",
          transformOrigin: "50% 100%",
        }}
        aria-label={`${item.label} ${item.sizeDisplay}`}
      >
        <svg
          width={columnW}
          height={columnH}
          viewBox={`0 0 ${columnW} ${columnH}`}
          style={{ overflow: "visible" }}
        >
          {/* 正面 */}
          <rect
            x={fxL}
            y={fyT}
            width={fxR - fxL}
            height={fyB - fyT}
            fill={front}
            stroke={stroke}
            strokeWidth={strokeW}
          />
          {/* 容积模式的水位由下方 HTML 波浪层负责，SVG 里不再画静态矩形
              （之前矩形顶边是平的，会把波浪边裁掉，反而破坏起伏感）。 */}
          {/* 顶面 */}
          <path
            d={pathPolyTop}
            fill={top}
            stroke={stroke}
            strokeWidth={strokeW}
          />
          {/* 右侧面 */}
          <path
            d={pathPolyRight}
            fill={right}
            stroke={stroke}
            strokeWidth={strokeW}
          />
        </svg>

        {/* 图标：铺满立方体正面 */}
        <div
          style={{
            position: "absolute",
            left: iconLeft,
            top: iconTop,
            width: iconBoxSize,
            height: iconBoxSize,
            lineHeight: 0,
            pointerEvents: "none",
          }}
        >
          <SmartIcon iconifyId={item.iconifyId} size={iconBoxSize} />
        </div>

      </motion.div>
      <div
        className="font-display font-bold whitespace-nowrap text-center"
        style={{
          width: columnW,
          marginTop: valueGap,
          fontSize: numberSize,
          color: isTarget ? "var(--primary-dark)" : "var(--foreground)",
          lineHeight: 1,
          overflow: "visible",
        }}
      >
        {item.sizeDisplay}
      </div>
    </div>
  );
}

/**
 * 竖向布局的"列"——高度对比时使用
 *
 *   ┌─────────────┐
 *   │  教室的高度  │  ← label pill (上方)
 *   └─────────────┘
 *      ┌────┐ ┐
 *      │    │ │
 *      │ 🏫 │ │ 8 米   ← 图标 + 右侧竖向测量条
 *      │    │ │
 *      └────┘ ┘
 *  ───────────────  ← 共享地面线
 *
 * iconSize = 真实高度按比例算出来的边长（正方形）。
 */
function VerticalColumn({
  item,
  iconSize,
  tallestIconSize,
  measureColW,
  labelPillH,
  labelGap,
  delay,
  whiteboard,
  axisWord,
}: {
  item: CompareItem;
  iconSize: number;
  tallestIconSize: number;
  measureColW: number;
  labelPillH: number;
  labelGap: number;
  delay: number;
  whiteboard: boolean;
  axisWord: string;
}) {
  const lineColor = item.isTarget
    ? "var(--primary-dark)"
    : "var(--foreground)";
  const lineStroke = item.isTarget ? 3 : 2.5;
  const capWidth = whiteboard ? 14 : 11;
  const numberSize = item.isTarget
    ? whiteboard
      ? 18
      : 15
    : whiteboard
      ? 16
      : 13;

  // 整列总高 = 最高图标 + 标签 pill + gap，把所有列的总高度对齐——这样地面线一致。
  const columnTotalH = tallestIconSize + labelPillH + labelGap;

  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{
        height: columnTotalH,
        flexShrink: 0,
      }}
    >
      {/* 标签 pill：浮在该图标的上方（按图标实际高度而非最高高度定位） */}
      <div
        style={{
          position: "absolute",
          bottom: iconSize + labelGap,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ItemNamePill
          item={item}
          whiteboard={whiteboard}
          axisWord={axisWord}
        />
      </div>

      {/* 图标 + 右侧测量条，并排（flex row）
          高度模式下图标高 = iconSize，宽度由 SVG 本征长宽比决定（fitHeight）。
          这样“校车”这种横向图标不会在高度轴上产生顶部留白，测量条与图标高度严格一致。 */}
      <div
        className="flex items-end"
        style={{ height: iconSize, gap: 4 }}
      >
        {/* 图标本体 + 入场动画 */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 14,
            mass: 0.9,
            delay,
            opacity: { duration: 0.2, delay },
          }}
          style={{
            height: iconSize,
            transformOrigin: "50% 100%",
            lineHeight: 0,
            display: "flex",
            alignItems: "flex-end",
            filter: item.isTarget
              ? "drop-shadow(0 4px 0 color-mix(in srgb, var(--primary-dark) 45%, transparent)) drop-shadow(0 0 12px color-mix(in srgb, var(--primary) 35%, transparent))"
              : "drop-shadow(0 3px 0 rgba(74,53,32,0.22)) drop-shadow(0 1px 0 rgba(255,255,255,0.55))",
          }}
        >
          <SmartIcon
            iconifyId={item.iconifyId}
            size={iconSize}
            bottomAlign
            aspectMode="fitHeight"
          />
        </motion.div>

        {/* 右侧竖向测量条：图形、标注线、数值从左到右排列 */}
        <div
          className="flex items-center"
          style={{
            height: iconSize,
            width: measureColW - 4,
            flexShrink: 0,
            gap: whiteboard ? 8 : 6,
          }}
          aria-label={`高度 ${item.sizeDisplay}`}
        >
          <div
            className="flex flex-col items-center"
            style={{
              height: iconSize,
              width: capWidth,
              flexShrink: 0,
            }}
          >
            {/* 顶 cap */}
            <span
              style={{
                width: capWidth,
                height: lineStroke,
                background: lineColor,
                borderRadius: 1,
              }}
            />
            {/* 中间竖线 */}
            <span
              style={{
                width: lineStroke,
                flex: 1,
                background: lineColor,
                borderRadius: 1,
              }}
            />
            {/* 底 cap */}
            <span
              style={{
                width: capWidth,
                height: lineStroke,
                background: lineColor,
                borderRadius: 1,
              }}
            />
          </div>
          <div
            className="font-display font-bold whitespace-nowrap"
            style={{
              fontSize: numberSize,
              color: lineColor,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {item.sizeDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}
