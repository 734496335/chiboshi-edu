"use client";

import { useState } from "react";

/**
 * 单位滑块
 *
 * 视觉：粗描边轨道 + 分段颜色 + 节点圆点 + 大圆形蓝色手柄
 * 设计参考：当前选中(错误)红、过头紫、正确绿、未选灰
 */

export interface UnitNode {
  unit: string;        // 显示名（如 "米"）
  /** "danger" 当前选中且错误 / "correct" 正确范围 / "over" 过头 / "neutral" 未选 */
  state: "danger" | "correct" | "over" | "neutral";
}

interface Props {
  nodes: UnitNode[];
  defaultIndex?: number;
  onChange?: (index: number, node: UnitNode) => void;
  /** 滑块上方提示文字（如 "选择单位 / 调整长度"） */
  label?: string;
}

const SEGMENT_COLOR: Record<UnitNode["state"], string> = {
  danger:  "var(--color-danger)",
  correct: "var(--color-success)",
  over:    "var(--color-accent)",
  neutral: "var(--neutral-3)",
};

const LABEL_COLOR: Record<UnitNode["state"], string> = {
  danger:  "var(--color-danger)",
  correct: "var(--color-success)",
  over:    "var(--color-accent)",
  neutral: "var(--neutral-5)",
};

export function UnitSlider({ nodes, defaultIndex = 0, onChange, label }: Props) {
  const [index, setIndex] = useState(defaultIndex);
  const n = nodes.length;

  function handleSelect(i: number) {
    setIndex(i);
    onChange?.(i, nodes[i]);
  }

  // 手柄位置百分比（按节点定位）
  const knobLeft = n > 1 ? (index / (n - 1)) * 100 : 50;

  return (
    <div className="w-full">
      {/* 上层：单位文字标签 */}
      <div className="relative mb-3 px-2" style={{ height: 32 }}>
        {nodes.map((node, i) => {
          const isActive = i === index;
          const left = n > 1 ? (i / (n - 1)) * 100 : 50;
          return (
            <button
              key={node.unit}
              type="button"
              onClick={() => handleSelect(i)}
              className="absolute -translate-x-1/2 font-black text-lg md:text-xl whitespace-nowrap transition"
              style={{
                left: `${left}%`,
                color: LABEL_COLOR[node.state],
                textShadow: isActive ? "0 2px 0 rgba(74,53,32,0.18)" : "none",
                transform: `translateX(-50%) scale(${isActive ? 1.15 : 1})`,
              }}
            >
              {node.unit}
            </button>
          );
        })}
      </div>

      {/* 滑块轨道（用 SVG 画分段彩色 + 描边） */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${(n - 1) * 100} 28`}
          preserveAspectRatio="none"
          width="100%"
          height="28"
          className="overflow-visible"
        >
          {/* 分段彩色填充 */}
          {nodes.slice(0, -1).map((node, i) => (
            <rect
              key={i}
              x={i * 100}
              y={6}
              width={100}
              height={16}
              fill={SEGMENT_COLOR[node.state]}
            />
          ))}
          {/* 整体粗描边 */}
          <rect
            x={0}
            y={6}
            width={(n - 1) * 100}
            height={16}
            fill="none"
            stroke="var(--outline)"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            rx={8}
          />
          {/* 节点圆点（除手柄位置外） */}
          {nodes.map((_, i) => {
            const cx = i * 100;
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={14}
                  r={7}
                  fill="#fff"
                  stroke="var(--outline)"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* 大圆形手柄（蓝色） */}
        <button
          type="button"
          aria-label="拖动选择单位"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition"
          style={{
            left: `${knobLeft}%`,
            width: 36,
            height: 36,
            background: "var(--color-primary)",
            border: "var(--outline-w) solid var(--outline)",
            boxShadow: "0 4px 0 rgba(74,53,32,0.30)",
          }}
        />

        {/* 透明 input 覆盖层用于键盘+触摸 */}
        <input
          type="range"
          min={0}
          max={n - 1}
          step={1}
          value={index}
          onChange={(e) => handleSelect(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="单位选择滑块"
        />
      </div>

      {label && (
        <div className="mt-4 text-center text-sm font-bold text-[color:var(--outline)]/60">
          {label}
        </div>
      )}
    </div>
  );
}
