"use client";

import { Drawer } from "vaul";
import { Check, X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  /** "correct" | "wrong" - 影响整体配色与文案 */
  result: "correct" | "wrong" | null;
  /** 标题（如 "Bingo！" / "再想想"）*/
  title: string;
  /** 详情说明（如 "正确答案是 厘米"） */
  message?: string;
  /** 确认按钮文字 */
  ctaLabel?: string;
  onContinue: () => void;
}

export function ResultDrawer({
  open,
  result,
  title,
  message,
  ctaLabel = "继续",
  onContinue,
}: Props) {
  const isCorrect = result === "correct";
  const accent = isCorrect ? "var(--success)" : "var(--danger)";
  const accentDark = isCorrect ? "var(--success-dark)" : "var(--danger-dark)";

  return (
    <Drawer.Root
      open={open}
      modal={false}
      shouldScaleBackground={false}
      dismissible={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 outline-none"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <div
            className={cn(
              "w-full px-5 md:px-10 pt-6 pb-7",
              "border-t-4",
              isCorrect ? "border-[var(--success)]" : "border-[var(--danger)]",
            )}
            style={{
              background: isCorrect
                ? "color-mix(in srgb, var(--success) 14%, #fff)"
                : "color-mix(in srgb, var(--danger) 14%, #fff)",
            }}
          >
            <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
              {/* 图标圆 */}
              <div
                className="shrink-0 flex items-center justify-center rounded-full"
                style={{
                  width: 60,
                  height: 60,
                  background: "#fff",
                  border: `2px solid ${accent}`,
                  borderBottomWidth: 4,
                  color: accentDark,
                }}
              >
                {isCorrect ? (
                  <Check strokeWidth={4} className="w-8 h-8" />
                ) : (
                  <X strokeWidth={4} className="w-8 h-8" />
                )}
              </div>

              {/* 文案 */}
              <div className="flex-1">
                <h3
                  className="font-display text-2xl md:text-3xl font-black mb-1"
                  style={{ color: accentDark }}
                >
                  {title}
                </h3>
                {message && (
                  <p
                    className="text-sm md:text-base font-semibold"
                    style={{ color: accentDark }}
                  >
                    {message}
                  </p>
                )}
              </div>

              {/* CTA */}
              <Button
                size="lg"
                variant={isCorrect ? "success" : "danger"}
                onClick={onContinue}
                className="w-full md:w-auto md:min-w-[160px]"
              >
                {ctaLabel}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
