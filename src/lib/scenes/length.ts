/**
 * 长度维度 · 每个单位选项对应的"动态场景"配置
 *
 * 用户在 TileSelect 上选不同单位，舞台实时切换：
 *   - 视觉对比物（跟铅笔同长度）
 *   - 状态徽章
 *   - 尺博士心情
 *   - 旁白文案
 *   - 长度标注的显示值/单位（米转换后更直观）
 */

import type { MascotMood } from "@/components/Mascot";

export type LengthUnit = "毫米" | "厘米" | "分米" | "米" | "千米";

export type SceneState = "over" | "correct" | "neutral" | "danger" | "extreme";

export interface LengthScene {
  state: SceneState;
  badge: { text: string; tone: "primary" | "success" | "danger" | "warning" };
  /** 与铅笔同长度的对比物 — CartoonAsset name */
  comparison: { asset: string; label: string; tone: string };
  speech: string;
  mascotMood: MascotMood;
  /** 长度标注上显示的值（已做单位换算到合理表达） */
  display: { value: string; unit: string };
}

/**
 * 题目：铅笔的长度是 18 ___ ?
 * 正确答案：厘米
 * 设计：每个错答案都对应一个"荒谬"或"不对劲"的场景
 */
export const LENGTH_Q3_SCENES: Record<LengthUnit, LengthScene> = {
  毫米: {
    state: "over",
    badge: { text: "嗯？也太迷你了！", tone: "warning" },
    comparison: { asset: "ant", label: "蚂蚁", tone: "tertiary" },
    speech: "哎呀！18毫米还没我一根羽毛长呢，这都看不见啦~",
    mascotMood: "thinking",
    display: { value: "1.8", unit: "厘米" },
  },
  厘米: {
    state: "correct",
    badge: { text: "Bingo！太棒了！", tone: "success" },
    comparison: { asset: "hand", label: "一只手掌", tone: "success" },
    speech: "答对啦！18厘米的铅笔正合适，刚好和你的手掌差不多长~",
    mascotMood: "happy",
    display: { value: "18", unit: "厘米" },
  },
  分米: {
    state: "neutral",
    badge: { text: "好像有点大哦…", tone: "warning" },
    comparison: { asset: "child", label: "一年级小朋友", tone: "warning" },
    speech: "嗯…18分米快赶上一年级小朋友的身高了？",
    mascotMood: "thinking",
    display: { value: "1.8", unit: "米" },
  },
  米: {
    state: "danger",
    badge: { text: "哇哦！好像不太对劲！", tone: "danger" },
    comparison: { asset: "bus", label: "公交车", tone: "primary" },
    speech: "天呐！这支铅笔和公交车一样长！你打算拿它给操场画线吗？",
    mascotMood: "shocked",
    display: { value: "18", unit: "米" },
  },
  千米: {
    state: "extreme",
    badge: { text: "哈哈哈哈太离谱啦！", tone: "danger" },
    comparison: { asset: "building", label: "好几座大楼", tone: "danger" },
    speech: "天呐！18千米都赶上从家到学校的距离啦，这哪是铅笔啊~",
    mascotMood: "laughing",
    display: { value: "18", unit: "千米" },
  },
};

export const LENGTH_Q3_OPTIONS: { value: LengthUnit; label: string; hint?: string }[] = [
  { value: "毫米", label: "毫米", hint: "mm" },
  { value: "厘米", label: "厘米", hint: "cm" },
  { value: "分米", label: "分米", hint: "dm" },
  { value: "米", label: "米", hint: "m" },
  { value: "千米", label: "千米", hint: "km" },
];

export const LENGTH_Q3_CORRECT: LengthUnit = "厘米";
