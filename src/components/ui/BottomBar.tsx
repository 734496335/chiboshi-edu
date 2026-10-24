"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export type CheckStatus = "none" | "correct" | "wrong" | "completed";

interface Props {
  /** 当前答题状态，决定染色和按钮文案/变体 */
  status: CheckStatus;
  /** 点击主按钮（检查 / 下一题 / 重试 / 继续） */
  onPrimary: () => void;
  /** 主按钮禁用状态（例如还没选选项） */
  disabled?: boolean;
  /** 次要操作（可选）—— 例如「提示」「跳过」「听一下读音」 */
  onSecondary?: () => void;
  secondaryLabel?: string;
  /** 自定义状态文案（不设则用默认） */
  correctMessage?: string;
  wrongMessage?: string;
  /** 自定义主按钮文案 */
  primaryLabels?: Partial<Record<CheckStatus, string>>;
  /** 白板大屏：放大字号和按钮 */
  whiteboard?: boolean;
  className?: string;
}

const DEFAULT_PRIMARY_LABELS: Record<CheckStatus, string> = {
  none: "检查",
  correct: "下一题",
  wrong: "再来一次",
  completed: "继续",
};

/**
 * Duolingo 风格底部反馈条
 * - 答题前：白底，主按钮 success；可选次按钮（提示）
 * - 答对：浅绿染色 + ✓ 「答对啦」 + 主按钮 success「下一题」
 * - 答错：浅红染色 + ✗ 「再想想看」 + 主按钮 danger「再来一次」
 * - 完成：白底 + 主按钮 success「继续」
 */
export function BottomBar({
  status,
  onPrimary,
  disabled,
  onSecondary,
  secondaryLabel = "提示一下",
  correctMessage = "答对啦！",
  wrongMessage = "再想想看～",
  primaryLabels,
  whiteboard = false,
  className,
}: Props) {
  // 回车键提交（仅当主按钮未禁用）
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !disabled) {
        e.preventDefault();
        onPrimary();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, onPrimary]);

  const primaryVariant =
    status === "wrong" ? "danger" : "success";

  const primaryLabel =
    primaryLabels?.[status] ?? DEFAULT_PRIMARY_LABELS[status];

  const heightClass = whiteboard
    ? "h-[140px] lg:h-[160px]"
    : "h-[96px] lg:h-[120px]";

  const innerMaxW = whiteboard ? "max-w-[1600px]" : "max-w-3xl";
  const btnSize = whiteboard ? "xl" : "lg";

  return (
    <footer
      className={cn("bottom-bar", status, heightClass, className)}
    >
      <div
        className={cn(
          "h-full mx-auto flex items-center justify-between gap-4 px-6 lg:px-10",
          innerMaxW,
        )}
      >
        {/* 左侧：状态文案 / 次按钮 / 占位 */}
        <div className="flex items-center gap-3 min-w-0">
          {status === "correct" && (
            <span className={cn("bottom-bar-status correct", whiteboard && "text-2xl")}>
              <CheckCircle2
                className={whiteboard ? "w-10 h-10" : "w-7 h-7"}
                strokeWidth={2.5}
              />
              {correctMessage}
            </span>
          )}
          {status === "wrong" && (
            <span className={cn("bottom-bar-status wrong", whiteboard && "text-2xl")}>
              <XCircle
                className={whiteboard ? "w-10 h-10" : "w-7 h-7"}
                strokeWidth={2.5}
              />
              {wrongMessage}
            </span>
          )}
          {status === "none" && onSecondary && (
            <Button
              variant="ghost"
              size={whiteboard ? "lg" : "md"}
              onClick={onSecondary}
              type="button"
            >
              <Lightbulb
                className={whiteboard ? "w-6 h-6" : "w-5 h-5"}
                strokeWidth={2.5}
              />
              {secondaryLabel}
            </Button>
          )}
        </div>

        {/* 右侧：主按钮 */}
        <Button
          variant={primaryVariant}
          size={btnSize}
          onClick={onPrimary}
          disabled={disabled}
          aria-disabled={disabled}
          type="button"
        >
          {primaryLabel}
        </Button>
      </div>
    </footer>
  );
}
