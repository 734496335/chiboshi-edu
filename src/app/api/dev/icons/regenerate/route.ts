/**
 * POST /api/dev/icons/regenerate
 * Body: { id: string, prompt?: string }
 *
 * - 若 prompt 提供，写回 visual-assets.json 对应条目的 prompt 字段。
 * - 调用 bake.py --only <id> --force，串行排队。
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { runBakeForId } from "@/lib/bake";
import { getBakeWorker } from "@/lib/bakeWorker";
import { invalidateCatalogCache } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

interface CatalogEntry {
  id: string;
  label: string;
  category: string;
  prompt?: string;
  [k: string]: unknown;
}

async function updateCatalogPrompt(
  catalogPath: string,
  id: string,
  newPrompt: string,
): Promise<{ before?: string; after: string }> {
  const raw = await fs.readFile(catalogPath, "utf8");
  const arr = JSON.parse(raw) as CatalogEntry[];
  const idx = arr.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error(`catalog 中没有 id="${id}"`);
  const before = arr[idx].prompt;
  arr[idx].prompt = newPrompt;
  const tmp = catalogPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(arr, null, 2) + "\n", "utf8");
  await fs.rename(tmp, catalogPath);
  return { before, after: newPrompt };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    prompt?: string;
  };
  const id = (body.id ?? "").trim();
  const promptOverride =
    typeof body.prompt === "string" ? body.prompt.trim() : undefined;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "missing id" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9_\-]+$/i.test(id)) {
    return NextResponse.json(
      { ok: false, error: "invalid id" },
      { status: 400 },
    );
  }

  const root = process.cwd();
  const catalogPath = path.join(
    root,
    "scripts",
    "pixel-bake",
    "visual-assets.json",
  );

  try {
    let promptUpdate: { before?: string; after: string } | null = null;
    if (promptOverride !== undefined && promptOverride.length > 0) {
      promptUpdate = await updateCatalogPrompt(catalogPath, id, promptOverride);
      invalidateCatalogCache();
    }
    // 优先走常驻 worker（>10x 快）；失败则一次性进程兜底，保证旧流程不断
    const useWorker = process.env.BAKE_NO_WORKER !== "1";
    if (useWorker) {
      const raw = await fs.readFile(catalogPath, "utf8");
      const arr = JSON.parse(raw) as CatalogEntry[];
      const entry = arr.find((e) => e.id === id);
      if (!entry) {
        return NextResponse.json(
          { ok: false, error: `id "${id}" not in catalog` },
          { status: 404 },
        );
      }

      // —— SSE 模式 ——
      // 客户端通过 Accept: text/event-stream 显式请求流式响应；其他客户端
      // (例如 IconQa) 仍走 JSON 同步响应，保持后向兼容。
      const wantsStream = req.headers
        .get("accept")
        ?.toLowerCase()
        .includes("text/event-stream");

      const worker = getBakeWorker();
      const outPng = path.join(
        process.cwd(),
        "public",
        "icons",
        "pixel",
        `${id}.png`,
      );

      if (wantsStream) {
        // SSE 协议：每个事件一行 `data: <json>\n\n`
        // 浏览器侧用 ReadableStream 解析（EventSource 不支持 POST，故走 fetch 流）
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start: async (controller) => {
            const send = (obj: Record<string, unknown>) => {
              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
                );
              } catch {
                // controller 已 close，忽略
              }
            };
            try {
              const r = await worker.bake(
                entry as unknown as Record<string, unknown>,
                (p) => send({ event: "progress", ...p }),
              );
              const pngExists = existsSync(outPng);
              if (!r.ok || !pngExists) {
                send({
                  event: "error",
                  error:
                    r.error ?? `worker reported failure; png=${pngExists}`,
                  elapsedMs: r.elapsedMs,
                  promptUpdate,
                });
              } else {
                invalidateCatalogCache();
                send({
                  event: "done",
                  ok: true,
                  id,
                  url: `/icons/pixel/${id}.png?t=${Date.now()}`,
                  elapsedMs: r.elapsedMs,
                  promptUpdate,
                });
              }
            } catch (e) {
              send({
                event: "error",
                error: e instanceof Error ? e.message : String(e),
              });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no", // 禁用反代缓冲
            Connection: "keep-alive",
          },
        });
      }

      // —— JSON 同步模式（旧客户端） ——
      const r = await worker.bake(entry as unknown as Record<string, unknown>);
      const pngExists = existsSync(outPng);
      if (!r.ok || !pngExists) {
        return NextResponse.json(
          {
            ok: false,
            error: r.error ?? `worker reported failure; png=${pngExists}`,
            elapsedMs: r.elapsedMs,
            promptUpdate,
          },
          { status: 500 },
        );
      }
      invalidateCatalogCache();
      return NextResponse.json({
        ok: true,
        id,
        url: `/icons/pixel/${id}.png?t=${Date.now()}`,
        elapsedMs: r.elapsedMs,
        promptUpdate,
        via: "worker",
      });
    }

    const result = await runBakeForId(id);
    if (result.code !== 0 || !result.pngExists) {
      return NextResponse.json(
        {
          ok: false,
          error: `bake.py exit ${result.code}, png exists=${result.pngExists}`,
          log: result.log.slice(-4000),
          elapsedMs: result.elapsedMs,
          promptUpdate,
        },
        { status: 500 },
      );
    }
    invalidateCatalogCache();
    return NextResponse.json({
      ok: true,
      id,
      url: `/icons/pixel/${id}.png?t=${Date.now()}`,
      elapsedMs: result.elapsedMs,
      promptUpdate,
      logTail: result.log.slice(-2000),
      via: "oneshot",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
