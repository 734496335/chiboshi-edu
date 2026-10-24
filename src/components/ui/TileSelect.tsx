"use client";

import { cn } from "@/lib/utils";

export interface TileOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
}

interface Props<V extends string = string> {
  options: TileOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  /** 当 disabled 时只展示状态，不接受点击（提交后用） */
  disabled?: boolean;
  /** 答题后展示对错状态：correct=绿、wrong=红，其他不变 */
  state?: Record<V, "correct" | "wrong" | undefined>;
  className?: string;
}

export function TileSelect<V extends string>({
  options,
  value,
  onChange,
  disabled,
  state,
  className,
}: Props<V>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "grid gap-3",
        options.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3 md:grid-cols-5",
        className,
      )}
    >
      {options.map((opt) => {
        const sel = value === opt.value;
        const tileState = state?.[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={sel}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "duo-tile",
              sel && !tileState && "selected",
              tileState === "correct" && "correct",
              tileState === "wrong" && "wrong",
            )}
          >
            <span className="text-xl md:text-2xl">{opt.label}</span>
            {opt.hint && (
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--ink-soft)" }}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
