/**
 * 长度标注线
 *
 *  ├─────────── 18 米 ───────────┤
 *
 * 上下两个端点小竖线 + 中间一条带箭头的水平线 + 中间标签胶囊
 */

interface Props {
  /** 显示的数值，如 18 */
  value: number | string;
  /** 显示的单位，如 "米" */
  unit: string;
  /** 标注颜色（默认深棕） */
  color?: string;
  /** 整体高度 */
  height?: number;
}

export function LengthIndicator({
  value,
  unit,
  color = "var(--outline)",
  height = 60,
}: Props) {
  return (
    <div className="w-full" style={{ height }}>
      <svg
        viewBox="0 0 1000 60"
        preserveAspectRatio="none"
        width="100%"
        height={height}
        className="overflow-visible"
      >
        {/* 主线：从 x=0 到 x=1000，严格对齐容器左右边 */}
        <line
          x1="0"
          y1="30"
          x2="1000"
          y2="30"
          stroke={color}
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />

        {/* 左端竖线（在 x=0） */}
        <line
          x1="0"
          y1="12"
          x2="0"
          y2="48"
          stroke={color}
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
        {/* 右端竖线（在 x=1000） */}
        <line
          x1="1000"
          y1="12"
          x2="1000"
          y2="48"
          stroke={color}
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />

        {/* 左箭头 */}
        <path
          d="M 4 30 L 28 22 M 4 30 L 28 38"
          stroke={color}
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          fill="none"
        />
        {/* 右箭头 */}
        <path
          d="M 996 30 L 972 22 M 996 30 L 972 38"
          stroke={color}
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          fill="none"
        />

        {/* 中间标签背景：白色胶囊 */}
        <rect
          x="430"
          y="10"
          width="140"
          height="40"
          rx="20"
          fill="#fff"
          stroke={color}
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
        />
        {/* 标签文字 */}
        <text
          x="500"
          y="40"
          textAnchor="middle"
          fontFamily="inherit"
          fontSize="24"
          fontWeight="900"
          fill={color}
        >
          {value} {unit}
        </text>
      </svg>
    </div>
  );
}
