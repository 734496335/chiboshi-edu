"use client";
/* 三柱跳动 loader。
   - 颜色取 currentColor，所以跟按钮文字色自动同色。
   - 用 CSS keyframes 而非 SVG SMIL：客户端水合后 SMIL 偶有不触发，CSS 100% 可靠。 */
import * as React from "react";

export function LoadingDots({
  size = 22,
  color,
}: {
  size?: number;
  color?: string;
}) {
  // 三个柱子的容器高度 = size；柱子宽 = size * 0.18
  const barW = Math.max(2, Math.round(size * 0.18));
  const gap = Math.max(2, Math.round(size * 0.16));
  const minH = Math.max(3, Math.round(size * 0.22));
  const bg = color ?? "currentColor";
  const bar: React.CSSProperties = {
    width: barW,
    height: minH,
    background: bg,
    borderRadius: 1,
    display: "inline-block",
    animation: "loading-dots-bounce 0.6s ease-in-out infinite",
  };
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        height: size,
        // 容器内对齐基线，让柱子从中线开始向两端拉伸的视觉感
        verticalAlign: "middle",
        ["--ld-min" as string]: `${minH}px`,
        ["--ld-max" as string]: `${Math.round(size * 0.95)}px`,
      }}
    >
      <span style={{ ...bar, animationDelay: "0s" }} />
      <span style={{ ...bar, animationDelay: "0.15s" }} />
      <span style={{ ...bar, animationDelay: "0.3s" }} />
      {/* 局部 keyframes，独立组件可携带样式 */}
      <style>{`
        @keyframes loading-dots-bounce {
          0%, 100% { height: var(--ld-min); }
          50%      { height: var(--ld-max); }
        }
      `}</style>
    </span>
  );
}
