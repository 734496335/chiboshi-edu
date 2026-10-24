"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface Props
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** 0 - 100 */
  value?: number;
  /** 进度条粗细：default 16, sm 12 */
  size?: "sm" | "md";
}

/**
 * Duolingo 风格顶部进度条
 * - 灰色轨道（带边框）
 * - 绿色填充（带顶部高光）
 * - 圆角胶囊
 */
export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  Props
>(({ className, value = 0, size = "md", ...props }, ref) => {
  const v = Math.max(0, Math.min(100, value));
  const h = size === "sm" ? "h-3" : "h-4";

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={v}
      className={cn(
        "relative w-full overflow-hidden rounded-full border-2 border-[var(--grey-200)] bg-[var(--grey-200)]",
        h,
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 rounded-full bg-[var(--success)] transition-transform duration-500 ease-out relative"
        style={{ transform: `translateX(-${100 - v}%)` }}
      >
        {/* 顶部高光 */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-[2px] left-2 right-2 h-[3px] rounded-full bg-white/55"
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = "Progress";
