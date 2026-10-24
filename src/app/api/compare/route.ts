/**
 * 量感对比 API - 一次性预计算所有单位节点的对比数据
 *
 * 输入：{ item: string, value: number, unit: string, dimension: DimensionKey }
 * 输出：包含 4 个单位节点的参照物、吐槽文案、量感锚点、迁移问题等完整数据
 *
 * TODO: 接入 DeepSeek API
 */

import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item, value, unit, dimension } = body ?? {};

    if (!item || value == null || !unit || !dimension) {
      return Response.json(
        { error: "缺少必填字段: item, value, unit, dimension" },
        { status: 400 },
      );
    }

    // 占位：返回硬编码的"铅笔12米"示例数据
    // 后续替换为 DeepSeek API 调用
    return Response.json({
      item,
      inputValue: value,
      inputUnit: unit,
      isCorrect: false,
      correctUnit: "cm",
      anchorTip: "铅笔 ≈ 一拃（大拇指到中指张开的距离）",
      unitBreakpoints: {
        m: {
          displayValue: `${value}米`,
          reference: "城市公交车",
          referenceSize: "约12米长",
          emoji: "🚌",
          mascotMood: "shocked",
          mascotLine: "天呐！这支铅笔和公交车一样长！你打算拿它给操场画线吗？",
          absurdityLevel: "extreme",
        },
        dm: {
          displayValue: `${value}分米`,
          reference: "一年级小朋友的身高",
          referenceSize: "约1.2米",
          emoji: "🧒",
          mascotMood: "thinking",
          mascotLine: "比小朋友还高的铅笔？像根魔法拐杖！",
          absurdityLevel: "moderate",
        },
        cm: {
          displayValue: `${value}厘米`,
          reference: "一个成人手掌的宽度",
          referenceSize: "约15厘米",
          emoji: "🤚",
          mascotMood: "happy",
          mascotLine: "Bingo！正好握在手心里，差不多一拃长！",
          absurdityLevel: "correct",
        },
        mm: {
          displayValue: `${value}毫米`,
          reference: "一颗花生米",
          referenceSize: "约12毫米",
          emoji: "🥜",
          mascotMood: "laughing",
          mascotLine: "哈哈！这么迷你的铅笔，你得用镊子夹着写字了！",
          absurdityLevel: "extreme",
        },
      },
      transferQuestion: {
        question: "你的文具盒大约有多长？",
        options: ["5厘米", "20厘米", "2米"],
        correctIndex: 1,
        explanation: "文具盒大约20厘米，差不多是两支铅笔的长度",
      },
    });
  } catch (e) {
    return Response.json(
      { error: "服务器错误", detail: String(e) },
      { status: 500 },
    );
  }
}
