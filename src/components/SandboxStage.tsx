"use client";

/**
 * 自由沙盒主舞台（客户端组件）
 *
 * 教师/学生在 InteractiveInput 输入"物体 + 数值 + 单位" → POST /api/ai/parse
 *   → VisualCompare 等比例画对比，OwlReaction 给点评。
 *
 * 与原 /whiteboard 页面共享同一套逻辑，差别仅在外层 chrome（沙盒在 dim 下作为子页面）。
 *
 * Props：
 *   - dimension：维度键（"length" / "weight" / ...）。当前只接 "length"。
 *   - dimensionLabel：用于占位文案，如 "长度"。
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { resolveAsset } from "@/lib/utils";
import {
  InteractiveInput,
  type InteractivePayload,
} from "@/components/InteractiveInput";
import { VisualCompare } from "@/components/VisualCompare";
import { OwlReaction } from "@/components/OwlReaction";
import { LoadingDots } from "@/components/LoadingDots";
import type { ParseResponse } from "@/app/api/ai/parse/route";
import type { DimensionKey } from "@/lib/dimensions";

interface Props {
  dimension: DimensionKey;
  dimensionLabel: string;
}

export function SandboxStage({ dimension, dimensionLabel }: Props) {
  // 字典 → 沙盒的预填："/play/length/sandbox?q=蓝鲸" 时把"蓝鲸"塞进输入框，
  // 孩子只要补一个数字/单位就能提交，闭环更顺。
  const searchParams = useSearchParams();
  const prefillQ = searchParams.get("q") ?? "";
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ParseResponse | null>(null);
  const [lastPayload, setLastPayload] =
    React.useState<InteractivePayload | null>(null);

  const callApi = async (
    payload: InteractivePayload,
    excludeRefs: string[],
  ): Promise<ParseResponse> => {
    // 新 InteractiveInput 只发原始句子，AI 负责拆 object/value/unit
    const res = await fetch(resolveAsset("/api/ai/parse"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: payload.text,
        dimension,
        exclude_refs: excludeRefs,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as ParseResponse;
  };

  const handleSubmit = async (payload: InteractivePayload) => {
    setLoading(true);
    setError(null);
    setLastPayload(payload);
    try {
      const data = await callApi(payload, []);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 当响应里 bake_pending=true 时，目标 PNG 还在烤；轮询直到它就绪，
  // 然后给 target_visual.iconId 拼上 cache-bust 触发 <img> 重新加载。
  React.useEffect(() => {
    if (!result?.bake_pending) return;
    const assetId = result.target_visual?.assetId;
    if (!assetId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(resolveAsset(`/icons/pixel/${assetId}.png`), {
          method: "HEAD",
          cache: "no-store",
        });
        if (res.ok && !stopped) {
          setResult((prev) => {
            if (!prev) return prev;
            const tv = prev.target_visual
              ? {
                  ...prev.target_visual,
                  iconId: `pixel-png:${assetId}?t=${Date.now()}`,
                }
              : prev.target_visual;
            return { ...prev, target_visual: tv, bake_pending: false };
          });
          return;
        }
      } catch {
        /* swallow */
      }
      timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 2000);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [result?.bake_pending, result?.target_visual?.assetId]);

  const handleRefreshRefs = async () => {
    if (!lastPayload || !result) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await callApi(lastPayload, result.comparison_refs);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="flex-1 mx-auto w-full max-w-[1600px] px-8 py-6 grid grid-cols-12 gap-8">
      {/* —— 左栏：输入卡（竖直居中）+ 猫头鹰反应（贴底）
              结构 = 顶占位 / 输入块 / 底占位 / 猫头鹰
              用嵌套 flex：
                外层 col + justify-between → 把输入和猫头鹰拉到两端
                输入块用 my-auto 在自己占据的空间里居中
              这样：输入卡在视觉正中，猫头鹰永远沉在底部，和右侧舞台底部对齐。 */}
      <div className="col-span-4 flex flex-col">
        <div className="flex-1 flex flex-col justify-center gap-6">
          <InteractiveInput
            onSubmit={handleSubmit}
            loading={loading}
            whiteboard={false}
            initialText={prefillQ}
            dimension={
              dimension === "area" ||
              dimension === "volume" ||
              dimension === "cubic" ||
              dimension === "weight" ||
              dimension === "time"
                ? dimension
                : "length"
            }
          />

          {error && (
            <div
              className="duo-card p-4 text-sm"
              style={{
                background: "color-mix(in srgb, var(--danger) 10%, #fff)",
                borderColor: "var(--danger)",
                color: "var(--danger-dark)",
              }}
            >
              ⚠️ 调用失败：{error}
            </div>
          )}
        </div>

        {/* 猫头鹰反应：永远贴左栏底部 */}
        {result && (
          <div className="mt-6 -ml-10">
            <OwlReaction tone={result.owl_tone} quip={result.owl_quip} />
          </div>
        )}
      </div>

      {/* —— 右：等比例对比舞台 —— */}
      <div className="col-span-8 flex flex-col gap-6">
        <div className="cartoon-stage flex-1 min-h-[560px] flex flex-col p-10 relative">
          {result ? (
            <>
              <VisualCompare
                targetLabel={result.object}
                targetValueSi={result.value_in_si}
                targetValueDisplay={`${result.value}${result.unit}`}
                targetUnit={result.unit}
                targetType={result.object_type}
                targetIcon={result.target_icon}
                targetVisual={result.target_visual}
                targetAxis={result.target_axis}
                dimension={result.dimension ?? dimension}
                refIcons={result.ref_icons}
                refVisuals={result.ref_visuals}
                references={result.resolved_refs}
                whiteboard
                className="my-auto"
              />

              {/* "换 N 个对比"按钮：吸附在舞台右下角。
                  N 由当前维度决定——重量维度是天平只对 1 个，其它是 2 个小+大。
                  文案要跟着改，否则"换两个"对天平场景说不通。 */}
              <button
                type="button"
                onClick={handleRefreshRefs}
                disabled={refreshing}
                aria-label={
                  dimension === "weight"
                    ? "换一个不一样的参照物"
                    : "换两个不一样的参照物"
                }
                className="font-display absolute transition-transform active:translate-y-[2px] disabled:opacity-50"
                style={{
                  right: 20,
                  bottom: 20,
                  fontSize: "1.5rem",
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "#FEF3C7",
                  color: "#92400E",
                  border: "2px solid #FCD34D",
                  borderBottomWidth: 4,
                  cursor: refreshing ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  zIndex: 5,
                  boxShadow: "0 2px 0 rgba(74,53,32,0.12)",
                }}
              >
                {!refreshing && (
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "1.5em",
                    }}
                  >
                    🎲
                  </span>
                )}
                {refreshing
                  ? "思考中"
                  : dimension === "weight"
                    ? "换一个对比"
                    : "换两个对比"}
                {refreshing && <LoadingDots size={22} />}
              </button>
            </>
          ) : (
            <EmptyStage loading={loading} />
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyStage({ loading }: { loading: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
      {/* 用 ip5.png 替换原来的 fluent-emoji 猫头鹰；
          外层 wrapper 跑 float-y keyframes 实现上下浮动（与首页三张卡同款节奏）。
          loading 时仍想要"思考"差异化 → 把动画稍微加速作为反馈。
          —— 尺寸调整：改下面的 width / height（同步改）即可；
                         单位 px。当前 360 = 占舞台中下大部分高度。 */}
      <div
        className="select-none"
        style={{
          width: 680,
          height: 680,
          animation: `float-y ${loading ? "1.6s" : "3s"} ease-in-out infinite`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAsset("/ip5.png")}
          alt="尺博士"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 12px 18px rgba(74,53,32,0.22))",
            pointerEvents: "none",
          }}
        />
      </div>
      {loading && (
        <div>
          <h2
            className="font-display"
            style={{ fontSize: "2rem", color: "var(--foreground)" }}
          >
            尺博士在想…
          </h2>         
        </div>
      )}
    </div>
  );
}
