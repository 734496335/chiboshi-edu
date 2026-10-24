"use client";

/**
 * /whiteboard
 *
 * 白板模式入口——课堂大屏专用。核心交互（输入 → AI → 等比对比）现在
 * 由共享的 `<SandboxStage />` 承载，本页只负责白板专属的 TopBar 框架。
 *
 * 教师常用流程：开课时直接打开 /whiteboard 投屏，全屏沉浸；
 * 学生练习/作业则走 /play/length/sandbox（带返回导航）。
 */

import * as React from "react";
import { TopBar } from "@/components/ui/TopBar";
import { SandboxStage } from "@/components/SandboxStage";

export default function WhiteboardPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <TopBar whiteboard exitHref="/" />
      <React.Suspense fallback={null}>
        <SandboxStage dimension="length" dimensionLabel="长度" />
      </React.Suspense>
    </main>
  );
}
