"use client";

import { Mascot, type MascotMood } from "./Mascot";
import { cn } from "@/lib/utils";

/** AI 返回的 owl_tone 映射到 Mascot 内部的 mood */
function toneToMood(tone: string): MascotMood {
  switch (tone) {
    case "shocked":
      return "shocked";
    case "laughing":
      return "laughing";
    case "thoughtful":
      return "thinking";
    case "happy":
    case "encouraging":
      return "happy";
    default:
      return "idle";
  }
}

interface Props {
  /** AI 返回的 owl_tone */
  tone: string;
  /** AI 返回的 owl_quip（一句俏皮话） */
  quip: string;
  /** 白板大屏模式 */
  whiteboard?: boolean;
  className?: string;
}

/**
 * 猫头鹰反应组件 = Mascot + 一句吐槽气泡
 *
 * 仅显示一句话。引导问题由教师自己在课堂上提，不再硬塞 UI。
 */
export function OwlReaction({
  tone,
  quip,
  whiteboard = false,
  className,
}: Props) {
  const mood = toneToMood(tone);
  const mascotSize = whiteboard ? 180 : 270;
  const quipSize = whiteboard ? "text-2xl" : "text-2xl";

  return (
    <div className={cn("flex items-start gap-0", className)}>
      <Mascot mood={mood} size={mascotSize} className="shrink-0" />
      <div className="min-w-0 max-w-[520px]">
        <div className={cn("speech-bubble", quipSize)}>
          <div
            className="font-display leading-tight"
            style={{ color: "var(--foreground)" }}
          >
            {quip}
          </div>
        </div>
      </div>
    </div>
  );
}
