/**
 * 服务端单例：常驻 Python bake_worker.py 子进程，避免每张图都重新加载 SDXL（>30s）。
 *
 * 设计要点：
 *   - **全局唯一**：用 globalThis 缓存，HMR 不重启 worker。
 *   - **懒启动**：第一次 bake 或显式 warmup() 调用时才 spawn。
 *   - **顺序队列**：SDXL 显存只够一张同时跑，pending jobs FIFO。
 *   - **线协议**：stdin 写 JSON\n，stdout 读 JSON\n（worker 端已保证）。
 *   - **健壮**：worker 崩溃 → 标记 dead，下一个请求触发重启；进行中任务全部 reject。
 *
 * 用法：
 *   const w = getBakeWorker();
 *   await w.warmup();              // 提前预热（可选，dev.bat 启动时调用）
 *   const r = await w.bake(refObj); // refObj 必须是完整 catalog entry
 */
import "server-only";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export function findCondaExe(): string | null {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const localApp = process.env.LOCALAPPDATA ?? "";
  const programData = process.env.ProgramData ?? "";
  const candidates = [
    `${home}\\miniconda3`,
    `${home}\\Miniconda3`,
    `${home}\\anaconda3`,
    `${home}\\Anaconda3`,
    `${home}\\AppData\\Local\\miniconda3`,
    `${localApp}\\miniconda3`,
    `${localApp}\\anaconda3`,
    `${programData}\\miniconda3`,
    `${programData}\\anaconda3`,
    "C:\\miniconda3",
    "C:\\Miniconda3",
    "C:\\anaconda3",
    "C:\\Anaconda3",
    "D:\\miniconda3",
    "D:\\anaconda3",
    "D:\\anaconda",
    "D:\\Anaconda",
    "D:\\RJ\\anaconda",
    "D:\\RJ\\Anaconda3",
  ];
  for (const root of candidates) {
    if (!root) continue;
    const exe = `${root}\\Scripts\\conda.exe`;
    if (existsSync(exe)) return exe;
  }
  return null;
}

export type WorkerStatus =
  | "idle" // never started
  | "starting" // process spawned, waiting for "ready"
  | "loading-base"
  | "loading-lora"
  | "loading-gpu"
  | "ready" // can take jobs
  | "busy" // running a job
  | "dead"; // crashed; will respawn on next request

export interface BakeProgressEvent {
  /** 阶段：encode = prompt encoding；denoise = 第 N 步去噪结束；decode = VAE/后处理 */
  stage: "encode" | "denoise" | "decode";
  /** denoise 时为 1..total；encode 为 0；decode 为 total */
  step: number;
  /** 总 denoise 步数（FLUX-schnell = 4） */
  total: number;
}

interface PendingJob {
  jobId: string;
  ref: Record<string, unknown>;
  resolve: (r: BakeJobResult) => void;
  reject: (e: Error) => void;
  startedAt?: number;
  /** 可选：推理过程中的真实进度回调（worker progress 事件触发） */
  onProgress?: (p: BakeProgressEvent) => void;
}

export interface BakeJobResult {
  ok: boolean;
  id: string;
  elapsedMs?: number;
  error?: string;
}

export interface BakerSnapshot {
  status: WorkerStatus;
  queueLen: number;
  pendingId: string | null;
  startedAt: number | null;
  readyAt: number | null;
  lastEvent: string | null;
  fatalError: string | null;
}

class BakeWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private status: WorkerStatus = "idle";
  private startupPromise: Promise<void> | null = null;
  private startupResolvers: Array<{
    resolve: () => void;
    reject: (e: Error) => void;
  }> = [];
  private queue: PendingJob[] = [];
  private current: PendingJob | null = null;
  private buf = "";
  private nextSeq = 1;
  private startedAt: number | null = null;
  private readyAt: number | null = null;
  private lastEvent: string | null = null;
  private fatalError: string | null = null;

  snapshot(): BakerSnapshot {
    return {
      status: this.status,
      queueLen: this.queue.length + (this.current ? 1 : 0),
      pendingId: this.current
        ? String((this.current.ref as { id?: string }).id ?? "")
        : null,
      startedAt: this.startedAt,
      readyAt: this.readyAt,
      lastEvent: this.lastEvent,
      fatalError: this.fatalError,
    };
  }

  /**
   * 启动 worker。已启动则返回同一个 promise；崩溃后调用会重启。
   */
  warmup(): Promise<void> {
    if (this.status === "ready" || this.status === "busy") {
      return Promise.resolve();
    }
    if (this.startupPromise) return this.startupPromise;
    this.startupPromise = this._spawn();
    return this.startupPromise;
  }

  private _spawn(): Promise<void> {
    const root = process.cwd();
    const workerPy = path.join(
      root,
      "scripts",
      "pixel-bake",
      "bake_worker.py",
    );
    if (!existsSync(workerPy)) {
      this.fatalError = `bake_worker.py not found at ${workerPy}`;
      this.status = "dead";
      return Promise.reject(new Error(this.fatalError));
    }
    const conda = findCondaExe();
    let cmd: string;
    let args: string[];
    if (conda) {
      cmd = conda;
      args = [
        "run",
        "--no-capture-output",
        "-n",
        "lianggan-pixel",
        "python",
        "-u",
        workerPy,
      ];
    } else {
      cmd = "python";
      args = ["-u", workerPy];
    }
    const child = spawn(cmd, args, {
      cwd: root,
      env: {
        ...process.env,
        CUDA_MODULE_LOADING: "LAZY",
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
      },
      windowsHide: true,
    });
    this.child = child;
    this.status = "starting";
    this.startedAt = Date.now();
    this.readyAt = null;
    this.fatalError = null;

    child.stdout.on("data", (b: Buffer) => this._onStdout(b.toString("utf8")));
    child.stderr.on("data", (b: Buffer) => {
      // 转发到 server 控制台便于调试，截断避免淹没
      const s = b.toString("utf8");
      if (s.length > 4000) {
        process.stderr.write(s.slice(0, 2000) + "\n...\n" + s.slice(-2000));
      } else {
        process.stderr.write(s);
      }
    });
    child.on("exit", (code, signal) => {
      const wasReady = this.readyAt !== null;
      console.warn(
        `[bake-worker] exited code=${code} signal=${signal} wasReady=${wasReady}`,
      );
      this.child = null;
      this.status = "dead";
      if (!this.fatalError) {
        this.fatalError = `worker exited code=${code} signal=${signal}`;
      }
      // 拒绝所有 pending（startup 等待者 + 队列 + 当前任务）
      const err = new Error(this.fatalError);
      for (const r of this.startupResolvers) r.reject(err);
      this.startupResolvers = [];
      if (this.current) {
        this.current.reject(err);
        this.current = null;
      }
      for (const j of this.queue) j.reject(err);
      this.queue = [];
      this.startupPromise = null;
    });
    child.on("error", (err) => {
      console.warn(`[bake-worker] spawn error: ${err.message}`);
      this.fatalError = err.message;
    });

    return new Promise<void>((resolve, reject) => {
      this.startupResolvers.push({ resolve, reject });
      // 5 分钟保险（首跑 SDXL 下载可能久）
      const timeoutMs = 5 * 60_000;
      const timer = setTimeout(() => {
        if (this.status !== "ready") {
          reject(new Error(`worker startup timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      // resolve/reject 都会清理
      this.startupResolvers[this.startupResolvers.length - 1] = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      };
    });
  }

  private _onStdout(chunk: string) {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        // 非结构化输出，可能是 transformers/diffusers 的 print —— 忽略
        process.stderr.write(`[bake-worker stdout?] ${line}\n`);
        continue;
      }
      this._handleEvent(msg);
    }
  }

  private _handleEvent(msg: Record<string, unknown>) {
    const evt = String(msg.event ?? "");
    this.lastEvent = evt;
    switch (evt) {
      case "starting":
        this.status = "starting";
        break;
      case "loading": {
        const stage = String(msg.stage ?? "base");
        this.status =
          stage === "lora"
            ? "loading-lora"
            : stage === "gpu"
              ? "loading-gpu"
              : "loading-base";
        break;
      }
      case "ready":
        this.status = "ready";
        this.readyAt = Date.now();
        for (const r of this.startupResolvers) r.resolve();
        this.startupResolvers = [];
        this._drain();
        break;
      case "fatal":
        this.fatalError = String(msg.error ?? "fatal");
        // exit 事件会做收尾
        break;
      case "baked":
      case "bake_failed": {
        const cur = this.current;
        if (!cur) return;
        const jobId = String(msg.jobId ?? "");
        if (jobId !== cur.jobId) {
          process.stderr.write(
            `[bake-worker] event jobId mismatch (got ${jobId}, expected ${cur.jobId})\n`,
          );
        }
        this.current = null;
        if (evt === "baked") {
          cur.resolve({
            ok: true,
            id: String(msg.id ?? ""),
            elapsedMs: Number(msg.elapsedMs ?? 0),
          });
        } else {
          cur.resolve({
            ok: false,
            id: String(msg.id ?? ""),
            elapsedMs: Number(msg.elapsedMs ?? 0),
            error: String(msg.error ?? "unknown error"),
          });
        }
        this.status = "ready";
        this._drain();
        break;
      }
      case "progress": {
        // 真实进度：worker 端通过 callback_on_step_end 抛出，每步去噪 +
        // encode/decode 边界各一次。前端 SSE 透传给 Lightbox。
        const cur = this.current;
        if (!cur || !cur.onProgress) break;
        const jobId = String(msg.jobId ?? "");
        if (jobId !== cur.jobId) break;
        const stage = String(msg.stage ?? "denoise");
        if (
          stage !== "encode" &&
          stage !== "denoise" &&
          stage !== "decode"
        ) {
          break;
        }
        try {
          cur.onProgress({
            stage,
            step: Number(msg.step ?? 0),
            total: Number(msg.total ?? 4),
          });
        } catch (e) {
          process.stderr.write(
            `[bake-worker] onProgress threw: ${e instanceof Error ? e.message : String(e)}\n`,
          );
        }
        break;
      }
      case "pong":
      case "bye":
      case "error":
        // diagnostic only
        break;
      default:
        process.stderr.write(`[bake-worker] unknown event: ${evt}\n`);
    }
  }

  private _drain() {
    if (this.status !== "ready") return;
    if (this.current) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    this.status = "busy";
    next.startedAt = Date.now();
    const payload =
      JSON.stringify({ op: "bake", jobId: next.jobId, ref: next.ref }) + "\n";
    this.child?.stdin.write(payload);
  }

  /**
   * 排入烘焙任务。worker 未启动会自动启动；崩溃也会自动重启（下一次请求）。
   *
   * @param onProgress 可选回调，每收到 worker 的 progress 事件就调用一次。
   *   FLUX-schnell 标配 4 步去噪，因此一次 bake 大约会触发 6 次进度回调：
   *     encode(0/4) → denoise(1..4 / 4) → decode(4/4)
   */
  async bake(
    ref: Record<string, unknown>,
    onProgress?: (p: BakeProgressEvent) => void,
  ): Promise<BakeJobResult> {
    if (this.status === "dead" || this.status === "idle") {
      // try (re)start
      try {
        await this.warmup();
      } catch (e) {
        return {
          ok: false,
          id: String((ref as { id?: string }).id ?? ""),
          error: e instanceof Error ? e.message : String(e),
        };
      }
    } else if (this.status !== "ready" && this.status !== "busy") {
      // still loading
      try {
        await this.warmup();
      } catch (e) {
        return {
          ok: false,
          id: String((ref as { id?: string }).id ?? ""),
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    return new Promise<BakeJobResult>((resolve, reject) => {
      const job: PendingJob = {
        jobId: `j${this.nextSeq++}`,
        ref,
        resolve,
        reject,
        onProgress,
      };
      this.queue.push(job);
      this._drain();
    });
  }
}

// HMR 安全：保持单例
type GlobalWithBaker = typeof globalThis & { __bakeWorker?: BakeWorker };
const g = globalThis as GlobalWithBaker;
export function getBakeWorker(): BakeWorker {
  if (!g.__bakeWorker) g.__bakeWorker = new BakeWorker();
  return g.__bakeWorker;
}
