/**
 * 尺博士（猫头鹰吉祥物）
 *
 * 渲染策略：
 * - 主体：Fluent Emoji 猫头鹰（微软开源，高质量卡通）
 * - 情绪：通过 Framer Motion 动画 + 反应表情气泡区分 5 种情绪
 * - 等 AI 生成的吉祥物 5 表情就位后，可替换为 <Image src={`/mascot/${mood}.svg`} />
 */

"use client";

import { motion, type VariantLabels, type TargetAndTransition, type Transition } from "framer-motion";
import { resolveAsset } from "@/lib/utils";

export type MascotMood = "idle" | "shocked" | "happy" | "thinking" | "laughing";

/**
 * 每种情绪对应的 PNG 素材路径。
 * idle 没有专门素材，用 happy 兜底（默认状态也是友好微笑）。
 */
const MOOD_IMAGE: Record<MascotMood, string> = {
  idle: "/ip-happy.png",
  happy: "/ip-happy.png",
  shocked: "/ip-shocked.png",
  laughing: "/ip-laughing.png",
  thinking: "/ip-thinking.png",
};

/** 每种情绪的主体动画 */
const MOOD_ANIMATION: Record<
  MascotMood,
  { animate: TargetAndTransition | VariantLabels; transition: Transition }
> = {
  idle: {
    animate: { y: [0, -4, 0] },
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
  },
  shocked: {
    animate: { scale: [1, 1.12, 1.05], rotate: [0, -6, 6, -3, 0] },
    transition: { duration: 0.55, ease: "easeInOut" },
  },
  happy: {
    animate: { y: [0, -8, 0], rotate: [0, -3, 3, 0] },
    transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    animate: { rotate: [-4, -10, -4] },
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
  laughing: {
    animate: { rotate: [-6, 6, -6], y: [0, -3, 0] },
    transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
  },
};

interface Props {
  mood?: MascotMood;
  size?: number;
  className?: string;
}

export function Mascot({ mood = "idle", size = 120, className = "" }: Props) {
  const { animate, transition } = MOOD_ANIMATION[mood];
  const src = MOOD_IMAGE[mood];

  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label={`尺博士 - ${mood}`}
      role="img"
    >
      <motion.div
        key={mood}
        animate={animate}
        transition={transition}
        style={{ width: size, height: size, transformOrigin: "50% 80%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAsset(src)}
          alt=""
          width={size}
          height={size}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 6px 8px rgba(74,53,32,0.18))",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      </motion.div>
    </div>
  );
}
