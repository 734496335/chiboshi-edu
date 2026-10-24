"use client";

import Link from "next/link";
import { Flame, Heart, X, Gem } from "lucide-react";
import { Progress } from "./Progress";
import { cn } from "@/lib/utils";

interface Props {
  /** 0-100 进度。不传则隐藏进度条（沙盘 / 白板模式） */
  progress?: number;
  /** 心心总数（生命）—— 不传则隐藏 */
  hearts?: number;
  /** 当前剩余心心 —— 不传则隐藏 */
  heartsLeft?: number;
  /** 连击天数（streak）*/
  streak?: number;
  /** 经验值 XP 或宝石数 */
  xp?: number;
  /** 退出链接 */
  exitHref?: string;
  /** 是否在白板大屏模式：放大字号 + 拉满宽 */
  whiteboard?: boolean;
  className?: string;
}

/**
 * Duolingo 风格顶部条
 * 布局：[X] [Progress--------] [🔥 streak] [💎 xp] [❤ hearts]
 */
export function TopBar({
  progress,
  hearts: _hearts,
  heartsLeft,
  streak,
  xp,
  exitHref = "/",
  whiteboard = false,
  className,
}: Props) {
  const maxW = whiteboard ? "max-w-[1600px]" : "max-w-3xl";
  const counterText = whiteboard ? "text-2xl" : "text-lg";
  const iconSize = whiteboard ? "w-9 h-9" : "w-7 h-7";

  return (
    <header
      className={cn(
        "w-full mx-auto flex items-center gap-4 px-4 py-3",
        maxW,
        className,
      )}
    >
      {/* 退出 X */}
      <Link
        href={exitHref}
        className="duo-btn ghost icon shrink-0"
        aria-label="退出"
      >
        <X
          className={whiteboard ? "w-7 h-7" : "w-5 h-5"}
          strokeWidth={3}
        />
      </Link>

      {/* 进度条（沙盘模式不传 progress 时隐藏） */}
      <div className="flex-1">
        {typeof progress === "number" && (
          <Progress value={progress} size="md" />
        )}
      </div>

      {/* 计数器区（streak / xp / hearts） */}
      <div className="flex items-center gap-4 shrink-0">
        {typeof streak === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-display font-black",
              counterText,
            )}
            style={{ color: "var(--warning-dark)" }}
            aria-label={`连击 ${streak} 天`}
          >
            <Flame
              className={iconSize}
              fill="var(--warning)"
              stroke="var(--warning-dark)"
              strokeWidth={2.5}
            />
            {streak}
          </span>
        )}

        {typeof xp === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-display font-black",
              counterText,
            )}
            style={{ color: "var(--primary-dark)" }}
            aria-label={`${xp} 经验值`}
          >
            <Gem
              className={iconSize}
              fill="var(--primary)"
              stroke="var(--primary-dark)"
              strokeWidth={2.5}
            />
            {xp}
          </span>
        )}

        {typeof heartsLeft === "number" && (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-display font-black",
            counterText,
          )}
          style={{ color: "var(--danger-dark)" }}
          aria-label={`${heartsLeft} 颗心`}
        >
          <Heart
            className={iconSize}
            fill="var(--danger)"
            stroke="var(--danger-dark)"
            strokeWidth={2.5}
          />
          {heartsLeft}
        </span>
        )}
      </div>
    </header>
  );
}
