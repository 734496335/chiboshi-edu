"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mascot } from "@/components/Mascot";
import { CartoonAsset } from "@/components/CartoonAsset";
import { LengthIndicator } from "@/components/LengthIndicator";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/ui/TopBar";
import { TileSelect } from "@/components/ui/TileSelect";
import { ResultDrawer } from "@/components/ui/ResultDrawer";
import {
  LENGTH_Q3_SCENES,
  LENGTH_Q3_OPTIONS,
  LENGTH_Q3_CORRECT,
  type LengthUnit,
} from "@/lib/scenes/length";
import { fireCelebration } from "@/lib/confetti";

const TONE_BG: Record<string, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  primary: "var(--primary)",
  tertiary: "var(--tertiary)",
};
const TONE_TEXT: Record<string, string> = {
  warning: "var(--foreground)",
  success: "#fff",
  danger: "#fff",
  primary: "#fff",
  tertiary: "#fff",
};

interface Props {
  dimensionKey: string;
  dimensionLabel: string;
}

export function ChallengeClient({ dimensionKey, dimensionLabel }: Props) {
  const [selected, setSelected] = useState<LengthUnit | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 当前预览场景：未选时默认显示「米」（标志性的荒谬场景）
  const previewUnit: LengthUnit = selected ?? "米";
  const scene = LENGTH_Q3_SCENES[previewUnit];
  const isCorrect = selected === LENGTH_Q3_CORRECT;

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
    setDrawerOpen(true);
    if (selected === LENGTH_Q3_CORRECT) fireCelebration();
  };

  const handleContinue = () => {
    setDrawerOpen(false);
    if (isCorrect) {
      // TODO: 进入下一题；MVP 先重置
      setSubmitted(false);
      setSelected(null);
    } else {
      // 答错后再答一次
      setSubmitted(false);
    }
  };

  const tileState = submitted
    ? Object.fromEntries(
        LENGTH_Q3_OPTIONS.map((o) => [
          o.value,
          o.value === LENGTH_Q3_CORRECT
            ? "correct"
            : o.value === selected
              ? "wrong"
              : undefined,
        ]),
      ) as Record<LengthUnit, "correct" | "wrong" | undefined>
    : undefined;

  return (
    <main className="min-h-screen pb-32">
      {/* ============ 顶栏 ============ */}
      <TopBar
        progress={60}
        hearts={5}
        heartsLeft={5}
        exitHref={`/play/${dimensionKey}`}
      />

      {/* ============ 题目大标题 ============ */}
      <div className="max-w-3xl mx-auto px-4 mt-2 mb-4">
        <h1 className="font-display text-2xl md:text-3xl text-[var(--foreground)] mb-1">
          {dimensionLabel}闯关 · 第 3 题
        </h1>
        <p className="text-base md:text-lg font-bold text-[var(--ink-soft)]">
          为下面这个句子选一个合适的单位 👇
        </p>
      </div>

      {/* ============ 主舞台 ============ */}
      <section className="max-w-3xl mx-auto px-4">
        <div className="cartoon-stage px-4 md:px-8 pt-6 pb-8 mb-6">
          {/* 状态徽章（动态） */}
          <div className="flex justify-center mb-5 relative z-10">
            <AnimatePresence mode="wait">
              <motion.span
                key={scene.badge.text}
                initial={{ scale: 0.7, opacity: 0, y: -8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="badge-pill"
                style={{
                  background: TONE_BG[scene.badge.tone],
                  color: TONE_TEXT[scene.badge.tone],
                  borderColor: TONE_BG[scene.badge.tone],
                  fontSize: 15,
                }}
              >
                {scene.badge.text}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* 视觉对比：限定总宽以避免物品过大，且徽章宽度 与图片区底部标注对齐 */}
          <div
            className="relative z-10 mx-auto"
            style={{ maxWidth: 380 }}
          >
            {/* 铅笔行 */}
            <div className="flex items-center gap-3 mb-2">
              <span
                className="shrink-0 badge-pill text-xs"
                style={{
                  background: "var(--secondary)",
                  color: "#fff",
                  borderColor: "var(--secondary-dark)",
                  width: 72,
                  justifyContent: "center",
                }}
              >
                铅笔
              </span>
              <div className="flex-1">
                <CartoonAsset
                  name="pencil"
                  label="铅笔"
                  width="100%"
                  height="auto"
                  style={{ display: "block" }}
                />
              </div>
            </div>

            {/* 对比物（动态切换） */}
            <div className="flex items-center gap-3 mb-1">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`label-${scene.comparison.asset}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="shrink-0 badge-pill text-xs"
                  style={{
                    background: TONE_BG[scene.comparison.tone],
                    color: TONE_TEXT[scene.comparison.tone],
                    borderColor: TONE_BG[scene.comparison.tone],
                    width: 72,
                    justifyContent: "center",
                  }}
                >
                  {scene.comparison.label}
                </motion.span>
              </AnimatePresence>
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={scene.comparison.asset}
                    initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  >
                    <CartoonAsset
                      name={scene.comparison.asset}
                      label={scene.comparison.label}
                      width="100%"
                      height="auto"
                      style={{ display: "block" }}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* 长度标注：pl 跟随徽章 72 + gap 12 = 84，使标注两端对齐图片两端 */}
            <div className="mt-2 pl-[84px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${scene.display.value}-${scene.display.unit}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <LengthIndicator
                    value={scene.display.value}
                    unit={scene.display.unit}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* 尺博士 + 气泡（右侧） */}
          <div className="relative z-10 mt-5 flex items-end justify-end gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={scene.speech}
                initial={{ opacity: 0, x: 12, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="speech-bubble right flex-1 max-w-md text-sm md:text-base"
              >
                {scene.speech}
              </motion.div>
            </AnimatePresence>
            <Mascot mood={scene.mascotMood} size={88} />
          </div>
        </div>

        {/* ============ 题目句 + 答题 ============ */}
        <div className="cartoon-card px-5 md:px-8 py-6">
          {/* 题目句子 */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-6 font-display text-xl md:text-2xl text-[var(--foreground)]">
            <CartoonAsset name="pencil" label="铅笔" size={36} />
            <span>铅笔的长度是</span>
            <span
              className="inline-flex items-center justify-center font-display"
              style={{
                minWidth: 56,
                height: 48,
                padding: "0 12px",
                background: "#fff",
                border: "2px solid var(--primary)",
                borderBottomWidth: 4,
                borderRadius: 12,
                color: "var(--primary-dark)",
                fontSize: 26,
              }}
            >
              18
            </span>
            <span
              className="inline-flex items-center justify-center font-display"
              style={{
                minWidth: 84,
                height: 48,
                padding: "0 12px",
                background: selected ? "var(--primary)" : "#fff",
                color: selected ? "#fff" : "var(--ink-soft)",
                border: "2px dashed",
                borderColor: selected ? "var(--primary-dark)" : "var(--grey-300)",
                borderBottomWidth: 4,
                borderBottomStyle: "solid",
                borderRadius: 12,
                fontSize: 22,
                transition: "all 200ms ease",
              }}
            >
              {selected ?? "?"}
            </span>
          </div>

          {/* 选项 Tiles */}
          <TileSelect
            options={LENGTH_Q3_OPTIONS}
            value={selected}
            onChange={(v) => !submitted && setSelected(v)}
            disabled={submitted}
            state={tileState}
          />
        </div>
      </section>

      {/* ============ 底部固定 CHECK 按钮 ============ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--background)] border-t-2 border-[var(--grey-200)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="hidden md:inline text-sm font-bold text-[var(--ink-mute)]">
            {selected ? `已选：${selected}` : "请先选择一个单位"}
          </span>
          <Button
            size="xl"
            variant={selected ? "success" : "ghost"}
            disabled={!selected || submitted}
            onClick={handleSubmit}
            className="flex-1 md:flex-none md:min-w-[200px]"
          >
            检查
          </Button>
        </div>
      </div>

      {/* ============ 结果抽屉 ============ */}
      <ResultDrawer
        open={drawerOpen}
        result={isCorrect ? "correct" : "wrong"}
        title={isCorrect ? "Bingo！答对啦！" : "再想想看~"}
        message={
          isCorrect
            ? "18 厘米的铅笔正合适，跟你的手掌差不多长。"
            : `正确答案是「${LENGTH_Q3_CORRECT}」 — ${selected ? `${selected} 太大啦` : ""}`
        }
        ctaLabel={isCorrect ? "下一题" : "再试一次"}
        onContinue={handleContinue}
      />
    </main>
  );
}
