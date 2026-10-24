"use client";

import * as React from "react";
import type { ReferenceObject } from "@/lib/references";
import { cn } from "@/lib/utils";

interface Props {
  /** 数量级最小值（SI 单位），默认 1mm */
  minSi?: number;
  /** 数量级最大值（SI 单位），默认 1000km */
  maxSi?: number;
  /** 当前用户输入的高亮值（SI 单位） */
  highlightValue?: number;
  /** 高亮标签（"楼层 200 米"） */
  highlightLabel?: string;
  /** 要显示的对比参考物 */
  references: ReferenceObject[];
  /** 白板大屏模式：放大尺寸 */
  whiteboard?: boolean;
  className?: string;
}

/**
 * 对数比例尺组件 —— 尺博士的视觉骨头
 *
 * 把 9 个数量级（1mm → 1000km）压缩到一根水平条上，
 * 任意大小的物体都能在合适的位置出现并与其他参考物对比。
 *
 * 这是教学量感的物理化呈现：数量级感 = 量感本质。
 */
export function ScaleRuler({
  minSi = 0.001,
  maxSi = 1_000_000,
  highlightValue,
  highlightLabel,
  references,
  whiteboard = false,
  className,
}: Props) {
  const logMin = Math.log10(minSi);
  const logMax = Math.log10(maxSi);

  const toPercent = React.useCallback(
    (si: number) => {
      if (!Number.isFinite(si) || si <= 0) return null;
      const log = Math.log10(si);
      const pct = ((log - logMin) / (logMax - logMin)) * 100;
      return Math.max(0, Math.min(100, pct));
    },
    [logMin, logMax],
  );

  /** 10 倍刻度位置（1mm, 1cm, 10cm, 1m, 10m, 100m, 1km, 10km, 100km, 1000km） */
  const decades = React.useMemo(() => {
    const xs: { si: number; label: string }[] = [];
    for (let exp = Math.ceil(logMin); exp <= Math.floor(logMax); exp++) {
      const si = Math.pow(10, exp);
      xs.push({ si, label: formatDecadeLabel(si) });
    }
    return xs;
  }, [logMin, logMax]);

  const trackHeight = whiteboard ? "h-3" : "h-2";
  const tickHeight = whiteboard ? "h-4" : "h-3";
  const refIconSize = whiteboard ? "text-5xl" : "text-3xl";
  const refLabelSize = whiteboard ? "text-base" : "text-xs";

  return (
    <div className={cn("relative w-full", className)}>
      {/* 参考物（在轨道上方，从轨道往上发射小标杆） */}
      <div className={cn("relative", whiteboard ? "h-40" : "h-28")}>
        {references.map((ref) => {
          const pct = toPercent(ref.size);
          if (pct == null) return null;
          return (
            <div
              key={ref.id}
              className="absolute -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pct}%`, bottom: 0 }}
            >
              <div className={cn("leading-none", refIconSize)}>
                {ref.emoji}
              </div>
              <div
                className={cn(
                  "mt-1 px-2 py-0.5 rounded-md bg-white/85 border border-[var(--grey-200)] font-display whitespace-nowrap",
                  refLabelSize,
                  ref.hainan && "text-[var(--teal-dark)]",
                )}
              >
                {ref.label}
              </div>
              <div
                className={cn(
                  "w-[2px] bg-[var(--grey-400)]",
                  whiteboard ? "h-4" : "h-3",
                )}
                aria-hidden
              />
            </div>
          );
        })}
      </div>

      {/* 轨道 */}
      <div
        className={cn(
          "relative w-full rounded-full bg-[var(--grey-200)] border-2 border-[var(--grey-200)]",
          trackHeight,
        )}
      >
        {/* 10 倍刻度记号 */}
        {decades.map((d) => {
          const pct = toPercent(d.si);
          if (pct == null) return null;
          return (
            <div
              key={d.label}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${pct}%` }}
            >
              <div
                className={cn(
                  "w-[2px] bg-[var(--grey-400)]",
                  tickHeight,
                )}
                aria-hidden
              />
            </div>
          );
        })}
      </div>

      {/* 10 倍刻度文字（在轨道下方） */}
      <div className="relative h-6 mt-1">
        {decades.map((d) => {
          const pct = toPercent(d.si);
          if (pct == null) return null;
          return (
            <div
              key={d.label}
              className={cn(
                "absolute -translate-x-1/2 font-display text-[color:var(--ink-mute)]",
                whiteboard ? "text-sm" : "text-xs",
              )}
              style={{ left: `${pct}%` }}
            >
              {d.label}
            </div>
          );
        })}
      </div>

      {/* 高亮箭头（用户输入） */}
      {highlightValue != null &&
        Number.isFinite(highlightValue) &&
        highlightValue > 0 && (
          <HighlightMarker
            percent={toPercent(highlightValue) ?? 0}
            label={highlightLabel}
            whiteboard={whiteboard}
          />
        )}
    </div>
  );
}

function HighlightMarker({
  percent,
  label,
  whiteboard,
}: {
  percent: number;
  label?: string;
  whiteboard: boolean;
}) {
  // 箭头从下方指向轨道
  // 计算位置时考虑高亮要"叠加"在所有参考物之上
  return (
    <div
      className="absolute -translate-x-1/2 anim-pop-in pointer-events-none"
      style={{
        // 高亮锚定在轨道位置（相对 ScaleRuler 容器）
        left: `${percent}%`,
        // 这里的 top 要正好对齐轨道：轨道在 references 区域之后
        // references h-28 (whiteboard h-40), 然后 ruler track h-2/h-3
        // 简化：top 用 calc + var
        top: whiteboard ? "9.5rem" : "6.75rem",
      }}
    >
      {/* 箭头三角 */}
      <div
        className={cn(
          "mx-auto",
          whiteboard ? "border-x-[12px] border-t-[14px]" : "border-x-[8px] border-t-[10px]",
        )}
        style={{
          width: 0,
          height: 0,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: "var(--primary)",
        }}
        aria-hidden
      />
      {/* 标签胶囊 */}
      {label && (
        <div
          className={cn(
            "mt-1 px-3 py-1 rounded-full bg-[var(--primary)] text-white font-display border-2 border-[var(--primary-dark)] border-b-4 whitespace-nowrap",
            whiteboard ? "text-base" : "text-sm",
          )}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/** 美化 10 倍刻度标签：1mm / 1cm / 10cm / 1m / 10m / 100m / 1km / 10km / 100km / 1000km */
function formatDecadeLabel(meters: number): string {
  if (meters < 0.01) return `${(meters * 1000).toFixed(0)}mm`;
  if (meters < 1) return `${(meters * 100).toFixed(0)}cm`;
  if (meters < 1000) return `${meters.toFixed(0)}m`;
  return `${(meters / 1000).toFixed(0)}km`;
}
