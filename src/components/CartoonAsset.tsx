/**
 * 卡通素材组件
 *
 * 三层 fallback：
 * 1) 本地 SVG（public/assets/{name}.svg）— 用户手动 AI 生成的素材覆盖
 * 2) Iconify Fluent Emoji（微软开源，MIT 许可，高质量卡通风格）— 默认
 * 3) 系统 emoji — 兜底
 */

import Image from "next/image";
import { Icon } from "@iconify/react";
import { resolveAsset } from "@/lib/utils";

/** 本地 SVG 覆盖（仅当用户在 public/assets/ 放了文件时启用）
 * pencil / bus：必须横向侧视图才能做"长度对比"，Fluent Emoji 是斜视角不合用
 */
const LOCAL_OVERRIDE = new Set<string>([
  "pencil",
  "bus",
]);

/** 素材名 → Fluent Emoji 图标 ID（来自 @iconify-json/fluent-emoji） */
const FLUENT_EMOJI: Record<string, string> = {
  pencil:       "fluent-emoji:pencil",
  bus:          "fluent-emoji:bus",
  eraser:       "fluent-emoji:soap",          // 没有橡皮，用近似
  ruler:        "fluent-emoji:straight-ruler",
  apple:        "fluent-emoji:red-apple",
  book:         "fluent-emoji:closed-book",
  hand:         "fluent-emoji:hand-with-fingers-splayed",
  child:        "fluent-emoji:child",
  owl:          "fluent-emoji:owl",
  ant:          "fluent-emoji:ant",
  peanut:       "fluent-emoji:peanuts",
  building:     "fluent-emoji:school",
  card:         "fluent-emoji:credit-card",
  paper:        "fluent-emoji:page-facing-up",
  egg:          "fluent-emoji:egg",
  car:          "fluent-emoji:automobile",
  coin:         "fluent-emoji:coin",
  waterbottle:  "fluent-emoji:plastic-bottle",
  bucket:       "fluent-emoji:bucket",
  bathtub:      "fluent-emoji:bathtub",
  stamp:        "fluent-emoji:postage-stamp",
  dice:         "fluent-emoji:game-die",
  hourglass:    "fluent-emoji:hourglass-done",
  clock:        "fluent-emoji:alarm-clock",
  pencilcase:   "fluent-emoji:school-backpack",
  backpack:     "fluent-emoji:school-backpack",
  chalk:        "fluent-emoji:pencil",
  blackboard:   "fluent-emoji:school",
  // 表情类（用于尺博士反应）
  shocked:      "fluent-emoji:face-with-open-mouth",
  happy:        "fluent-emoji:smiling-face-with-smiling-eyes",
  thinking:     "fluent-emoji:thinking-face",
  laughing:     "fluent-emoji:rolling-on-the-floor-laughing",
};

/** 最后一层兜底：纯文本 emoji */
const EMOJI_FALLBACK: Record<string, string> = {
  pencil: "✏️", bus: "🚌", eraser: "🧽", ruler: "📏", apple: "🍎",
  book: "📕", hand: "🖐️", child: "🧒", owl: "🦉", ant: "🐜",
  peanut: "🥜", building: "🏫",
};

interface Props {
  name: string;
  /** 正方形尺寸 px（与 width/height 二选一） */
  size?: number;
  /** 显式宽度（px 或 css 字符串如 "100%"） */
  width?: number | string;
  /** 显式高度 */
  height?: number | string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CartoonAsset({
  name,
  size = 120,
  width,
  height,
  label,
  className = "",
  style,
}: Props) {
  const w = width ?? size;
  const h = height ?? size;

  // 1) 本地 SVG 覆盖 - 用原生 <img> 以支持百分比宽度
  if (LOCAL_OVERRIDE.has(name)) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={resolveAsset(`/assets/${name}.svg`)}
        alt={label || name}
        className={`select-none ${className}`}
        style={{ width: w, height: h, ...style }}
      />
    );
  }

  // 2) Iconify Fluent Emoji（默认）
  const iconId = FLUENT_EMOJI[name];
  if (iconId) {
    return (
      <Icon
        icon={iconId}
        width={size}
        height={size}
        className={`select-none inline-block ${className}`}
        style={style}
        aria-label={label || name}
      />
    );
  }

  // 3) 系统 emoji 兜底
  const fallback = EMOJI_FALLBACK[name] || "❓";
  return (
    <span
      role="img"
      aria-label={label || name}
      className={`inline-block select-none ${className}`}
      style={{ fontSize: size, lineHeight: 1, ...style }}
    >
      {fallback}
    </span>
  );
}
