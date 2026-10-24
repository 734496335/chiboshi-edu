"use client";

/**
 * 自由输入面板（儿童友好版）
 *
 * 设计原则：
 *   1. 单焦点：一个大输入框，一个"开始"按钮，没有别的控件抢戏。
 *   2. 自我说明：placeholder 就是完整范例句，孩子一看就知道该说啥。
 *   3. 预设是诱饵不是补救：彩色圆角胶囊，每个带 emoji + 完整句子，点了直接出结果。
 *   4. AI 兜底：把句子整块发给 /api/ai/parse，由 LLM 拆 object/value/unit；
 *      正则 fallback 在前端再做一次（防 AI 抽风返 fallback 时也能用）。
 *
 * 沟通策略：
 *   - 不再露出"物品 / 数值 / 单位"这种数据库术语。
 *   - 用第二人称 + 行动号召："说一个物品 + 它有多大"。
 *   - 错误时不弹弹窗，输入框轻轻晃动 + 微红描边。
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { LoadingDots } from "./LoadingDots";

export interface InteractivePayload {
  /** 自然语言原文，如 "教室长 8 米"。后端 AI 负责解析。 */
  text: string;
}

interface Preset {
  /** emoji 头像 */
  icon: string;
  /** 完整句子（点了就提交） */
  text: string;
  /** 卡片背景色调 */
  tone: "sky" | "lime" | "rose" | "amber" | "violet";
}

interface Props {
  onSubmit: (payload: InteractivePayload) => void;
  loading?: boolean;
  /** 白板模式：放大字号 */
  whiteboard?: boolean;
  /** 当前维度——决定 placeholder 范例 + 预设按钮 */
  dimension?: "length" | "area" | "volume" | "cubic" | "weight" | "time";
  presets?: Preset[];
  /** 预填文本——从字典/挑战页跳过来时带入物品名，孩子只需补单位即可。 */
  initialText?: string;
  className?: string;
}

const LENGTH_PRESETS: Preset[] = [
  { icon: "🐜", text: "蚂蚁长 5 米", tone: "lime" },
  { icon: "🌴", text: "椰子树高 25 米", tone: "amber" },
  { icon: "🏫", text: "教室长 8 米", tone: "sky" },
  { icon: "🚛", text: "卡车长 8 千米", tone: "rose" },
  { icon: "🐶", text: "狗狗长 1 千米", tone: "violet" },
];

const AREA_PRESETS: Preset[] = [
  { icon: "📮", text: "邮票面积 4 平方厘米", tone: "lime" },
  { icon: "📕", text: "数学课本面积 380 平方厘米", tone: "amber" },
  { icon: "🏫", text: "教室地面 56 平方米", tone: "sky" },
  { icon: "🏀", text: "篮球场 420 平方米", tone: "rose" },
  { icon: "🏟️", text: "足球场 7140 平方米", tone: "violet" },
];

const VOLUME_PRESETS: Preset[] = [
  { icon: "🥄", text: "茶匙容积 5 毫升", tone: "lime" },
  { icon: "💧", text: "矿泉水瓶 550 毫升", tone: "sky" },
  { icon: "🫖", text: "热水壶 1.5 升", tone: "amber" },
  { icon: "🪣", text: "水桶 18 升", tone: "rose" },
  { icon: "🛁", text: "浴缸 200 升", tone: "violet" },
];

const CUBIC_PRESETS: Preset[] = [
  { icon: "🎲", text: "骰子 1 立方厘米", tone: "lime" },
  { icon: "🧊", text: "魔方 216 立方厘米", tone: "amber" },
  { icon: "🎒", text: "书包 25 立方分米", tone: "sky" },
  { icon: "🧊", text: "冰箱 0.5 立方米", tone: "violet" },
  { icon: "📦", text: "集装箱 33 立方米", tone: "rose" },
];

const WEIGHT_PRESETS: Preset[] = [
  { icon: "🥚", text: "鸡蛋 55 克", tone: "lime" },
  { icon: "🍎", text: "苹果 200 克", tone: "rose" },
  { icon: "🎒", text: "书包 3 千克", tone: "sky" },
  { icon: "🍉", text: "西瓜 5 千克", tone: "amber" },
  { icon: "🐘", text: "大象 4 吨", tone: "violet" },
];

const TIME_PRESETS: Preset[] = [
  { icon: "❤️", text: "心跳一次 0.85 秒", tone: "rose" },
  { icon: "💨", text: "深呼吸 4 秒", tone: "lime" },
  { icon: "🪥", text: "刷牙 3 分钟", tone: "sky" },
  { icon: "🏫", text: "一节课 40 分钟", tone: "amber" },
  { icon: "🏖️", text: "暑假 60 天", tone: "violet" },
];

type DimKey = "length" | "area" | "volume" | "cubic" | "weight" | "time";

const PLACEHOLDER_BY_DIM: Record<DimKey, string> = {
  length: "教室长 8 米",
  area: "教室地面 56 平方米",
  volume: "矿泉水瓶 550 毫升",
  cubic: "魔方 216 立方厘米",
  weight: "苹果 200 克",
  time: "一节课 40 分钟",
};

const TITLE_BY_DIM: Record<DimKey, string> = {
  length: "随便说一个物品，它有多长？",
  area: "随便说一个物品，它有多大？",
  volume: "随便说一个容器，它能装多少？",
  cubic: "随便说一个物品，它占多大空间？",
  weight: "随便说一个物品，它有多重？",
  time: "随便说一件事，它要多久？",
};

const PRESETS_BY_DIM: Record<DimKey, Preset[]> = {
  length: LENGTH_PRESETS,
  area: AREA_PRESETS,
  volume: VOLUME_PRESETS,
  cubic: CUBIC_PRESETS,
  weight: WEIGHT_PRESETS,
  time: TIME_PRESETS,
};

const TONE_STYLES: Record<Preset["tone"], { bg: string; border: string; text: string }> = {
  sky:    { bg: "#E0F2FE", border: "#7DD3FC", text: "#0369A1" },
  lime:   { bg: "#ECFCCB", border: "#BEF264", text: "#3F6212" },
  rose:   { bg: "#FFE4E6", border: "#FDA4AF", text: "#9F1239" },
  amber:  { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" },
  violet: { bg: "#EDE9FE", border: "#C4B5FD", text: "#5B21B6" },
};

export function InteractiveInput({
  onSubmit,
  loading = false,
  whiteboard = false,
  dimension = "length",
  presets,
  initialText,
  className,
}: Props) {
  const effectivePresets = presets ?? PRESETS_BY_DIM[dimension];
  const placeholder = PLACEHOLDER_BY_DIM[dimension];
  const title = TITLE_BY_DIM[dimension];
  const [text, setText] = React.useState(initialText ?? "");
  const [shake, setShake] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 让输入合法的最低门槛：包含至少一个数字（不再卡 unit，AI 兜底）
  const trimmed = text.trim();
  const hasNumber = /\d/.test(trimmed);
  const canSubmit = trimmed.length >= 2 && hasNumber && !loading;

  const submit = React.useCallback(() => {
    if (!canSubmit) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
      return;
    }
    onSubmit({ text: trimmed });
  }, [canSubmit, trimmed, onSubmit]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const applyPreset = (p: Preset) => {
    setText(p.text);
    onSubmit({ text: p.text });
  };

  const inputFontSize = whiteboard ? 32 : 24;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* 标题：第二人称 + 动作号召（不加副标题，靠 placeholder + 预设自解释） */}
      <h2
        className="font-display text-center"
        style={{
          fontSize: whiteboard ? "1.75rem" : "1.4rem",
          color: "var(--foreground)",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>

      {/* 单一输入框：完整句子风格 */}
      <div
        className={cn("relative transition-transform", shake && "shake")}
        style={{ animation: shake ? "shake 0.4s" : undefined }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
          disabled={loading}
          placeholder={placeholder}
          aria-label={title}
          className="font-display w-full outline-none transition-all"
          style={{
            fontSize: inputFontSize,
            padding: whiteboard ? "20px 24px" : "16px 20px",
            borderRadius: 24,
            background: "#fff",
            border: "3px solid #E5D9B6",
            borderBottomWidth: 6,
            color: "var(--foreground)",
            textAlign: "center",
            caretColor: "var(--primary)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E5D9B6";
          }}
        />
      </div>

      {/* 主按钮：单一焦点，居中，超大 */}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit && !loading}
        aria-label="开始对比"
        className="font-display self-center transition-transform active:translate-y-[3px]"
        style={{
          fontSize: whiteboard ? 28 : 22,
          padding: whiteboard ? "16px 56px" : "14px 44px",
          borderRadius: 24,
          background: canSubmit || loading
            ? "linear-gradient(180deg, #FFC83D 0%, #F0A91A 100%)"
            : "#E5D9B6",
          color: canSubmit || loading ? "#4A3520" : "#A89A78",
          border: `3px solid ${canSubmit || loading ? "#C77F0F" : "#C9BC95"}`,
          borderBottomWidth: 6,
          boxShadow: canSubmit || loading ? "0 4px 0 rgba(74,53,32,0.18)" : "none",
          cursor: loading ? "wait" : canSubmit ? "pointer" : "not-allowed",
          letterSpacing: "0.05em",
        }}
      >
        {loading ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            尺博士在想
            <LoadingDots size={whiteboard ? 26 : 22} />
          </span>
        ) : (
          "📏 量 一 量"
        )}
      </button>

      {/* 预设：彩色胶囊，每个独立 emoji + 完整句 */}
      <div className="flex flex-col gap-2 items-center">
        <div
          className="font-display"
          style={{
            fontSize: whiteboard ? "1rem" : "1rem",
            color: "var(--ink-mute)",
          }}
        >
          不知道说啥？戳一个 👇
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {effectivePresets.map((p) => {
            const c = TONE_STYLES[p.tone];
            return (
              <button
                key={p.text}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={loading}
                className="font-display transition-transform active:translate-y-[2px] disabled:opacity-50"
                style={{
                  fontSize: whiteboard ? "1.05rem" : "1.16rem",
                  padding: whiteboard ? "10px 18px" : "8px 14px",
                  borderRadius: 999,
                  background: c.bg,
                  color: c.text,
                  border: `2px solid ${c.border}`,
                  borderBottomWidth: 4,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: "1.2em" }}>{p.icon}</span>
                <span>{p.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
