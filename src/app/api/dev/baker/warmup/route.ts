/**
 * GET  /api/dev/baker/warmup → 触发 worker 启动（不等就绪），返回当前快照
 * POST /api/dev/baker/warmup → 同上但等待 ready（首次最长 5 分钟）
 *
 * dev.bat 启动后会以 GET 方式 fire-and-forget 调用，让 SDXL 在后台加载。
 * /dev/icons 页面可以轮询 GET 看进度。
 */
import { NextRequest, NextResponse } from "next/server";
import { getBakeWorker } from "@/lib/bakeWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET() {
  const worker = getBakeWorker();
  // fire-and-forget：返回时不等 ready，前端轮询拿进度
  void worker.warmup().catch(() => {
    /* snapshot 已记录 fatalError */
  });
  return NextResponse.json({ ok: true, ...worker.snapshot() });
}

export async function POST(_req: NextRequest) {
  const worker = getBakeWorker();
  try {
    await worker.warmup();
    return NextResponse.json({ ok: true, ...worker.snapshot() });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        ...worker.snapshot(),
      },
      { status: 500 },
    );
  }
}
