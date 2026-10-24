/**
 * 服务端共享：调用 scripts/pixel-bake/bake.py 烘单条 PNG。
 *
 * 抽自 /api/dev/icons/regenerate，被它和 /api/ai/bake-on-demand 共用：
 *   - 进程内互斥（同时只跑一个 SDXL）
 *   - 自动发现 conda + lianggan-pixel 环境
 *   - 串行排队，避免并发挤显存
 */
import "server-only";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

let bakeChain: Promise<unknown> = Promise.resolve();
export function withBakeLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = bakeChain.then(fn, fn);
  bakeChain = next.catch(() => undefined);
  return next;
}

function findCondaExe(): string | null {
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

export interface BakeRunResult {
  code: number;
  log: string;
  elapsedMs: number;
  pngExists: boolean;
}

export async function runBakeForId(id: string): Promise<BakeRunResult> {
  const root = process.cwd();
  const bakePy = path.join(root, "scripts", "pixel-bake", "bake.py");
  const catalog = path.join(
    root,
    "scripts",
    "pixel-bake",
    "visual-assets.json",
  );
  const outPng = path.join(root, "public", "icons", "pixel", `${id}.png`);

  return withBakeLock(async () => {
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
        bakePy,
        "--catalog",
        catalog,
        "--only",
        id,
        "--force",
      ];
    } else {
      cmd = "python";
      args = [bakePy, "--catalog", catalog, "--only", id, "--force"];
    }
    const t0 = Date.now();
    const result = await new Promise<{ code: number; log: string }>(
      (resolve) => {
        const child = spawn(cmd, args, {
          cwd: root,
          env: { ...process.env, CUDA_MODULE_LOADING: "LAZY" },
          windowsHide: true,
        });
        let log = "";
        const onData = (b: Buffer) => {
          log += b.toString("utf8");
          if (log.length > 20000) log = log.slice(-20000);
        };
        child.stdout.on("data", onData);
        child.stderr.on("data", onData);
        child.on("error", (err) => {
          log += `\n[spawn error] ${err.message}\n`;
          resolve({ code: -1, log });
        });
        child.on("close", (code) => resolve({ code: code ?? -1, log }));
      },
    );
    const elapsedMs = Date.now() - t0;
    const pngExists = await fs
      .stat(outPng)
      .then(() => true)
      .catch(() => false);
    return { ...result, elapsedMs, pngExists };
  });
}
