// 六大计量维度配置
// 决定了首页/各种入口的展示和路由

export type DimensionKey =
  | "length"
  | "weight"
  | "volume"
  | "area"
  | "cubic"
  | "time";

export interface Dimension {
  key: DimensionKey;
  label: string;          // 中文名
  emoji: string;          // 暂用 Emoji 占位
  units: string;          // 单位说明
  color: string;          // CSS 变量
  bgClass: string;        // tailwind 背景色（用于卡片）
  ringClass: string;      // tailwind 描边色
  available: boolean;     // 是否可用（MVP 只开 length）
  description: string;    // 一句话简介
}

export const DIMENSIONS: Dimension[] = [
  {
    key: "length",
    label: "长度",
    emoji: "📏",
    units: "毫米/厘米/分米/米",
    color: "var(--dim-length)",
    bgClass: "bg-sky-100",
    ringClass: "ring-sky-300",
    available: true,
    description: "铅笔有多长？教室有多宽？",
  },
  {
    key: "weight",
    label: "重量",
    emoji: "⚖️",
    units: "克/千克",
    color: "var(--dim-weight)",
    bgClass: "bg-orange-100",
    ringClass: "ring-orange-300",
    available: true,
    description: "苹果有多重？书包压不压得动你？",
  },
  {
    key: "volume",
    label: "容积",
    emoji: "🥤",
    units: "毫升/升",
    color: "var(--dim-volume)",
    bgClass: "bg-emerald-100",
    ringClass: "ring-emerald-300",
    available: true,
    description: "矿泉水瓶能装多少水？",
  },
  {
    key: "area",
    label: "面积",
    emoji: "📐",
    units: "平方厘米/平方米",
    color: "var(--dim-area)",
    bgClass: "bg-violet-100",
    ringClass: "ring-violet-300",
    available: true,
    description: "邮票有多大？操场有多大？",
  },
  {
    key: "cubic",
    label: "体积",
    emoji: "📦",
    units: "立方厘米/立方米",
    color: "var(--dim-3d)",
    bgClass: "bg-rose-100",
    ringClass: "ring-rose-300",
    available: true,
    description: "魔方占多少空间？冰箱呢？",
  },
  {
    key: "time",
    label: "时间",
    emoji: "⏰",
    units: "秒/分/时",
    color: "var(--dim-time)",
    bgClass: "bg-yellow-100",
    ringClass: "ring-yellow-300",
    available: true,
    description: "眨眨眼几秒？一节课多久？",
  },
];

export function getDimension(key: DimensionKey): Dimension | undefined {
  return DIMENSIONS.find((d) => d.key === key);
}
