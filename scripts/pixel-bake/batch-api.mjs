/**
 * 批量通过 /api/ai/pixel 接口生成所有 reference 的像素画 SVG。
 *
 * 用法：
 *   1. 先确保 dev server 在跑：npm run dev
 *   2. 运行：node scripts/pixel-bake/batch-api.mjs
 *
 * 支持中断续跑（已缓存的自动跳过）。
 * 可选参数：
 *   --force        强制重新生成（覆盖缓存）
 *   --concurrency=N  并发数，默认 1（MiMo 推理慢，并发多没用）
 *   --base=URL     API 地址，默认 http://localhost:3000
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, "../..");

// ─── 参数解析 ─────────────────────────────────────────────
const args = process.argv.slice(2);
const force = args.includes("--force");
const base = (args.find((a) => a.startsWith("--base=")) || "").split("=")[1] || "http://localhost:3000";
const concurrency = Number((args.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1]) || 1;

// ─── dump refs ────────────────────────────────────────────
const refsPath = path.join(__dirname, "refs.json");
if (!existsSync(refsPath)) {
  console.log("[batch] dumping refs.json ...");
  execSync(`npx tsx scripts/pixel-bake/_dump-refs.mts > scripts/pixel-bake/refs.json`, {
    cwd: PROJECT,
    stdio: ["pipe", "pipe", "inherit"],
  });
}
const refs = JSON.parse(readFileSync(refsPath, "utf8"));
console.log(`[batch] 共 ${refs.length} 个 references，force=${force}, concurrency=${concurrency}`);

// ─── 生成逻辑 ─────────────────────────────────────────────
let done = 0, cached = 0, failed = 0;
const failures = [];
const startTime = Date.now();

async function generate(ref) {
  const label = ref.label;
  const url = `${base}/api/ai/pixel`;
  const body = JSON.stringify({ object: label, force });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 360_000); // 6 min safety

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    if (res.ok) {
      done++;
      if (data.cached) {
        cached++;
        console.log(`  [${done}/${refs.length}] ✓ ${label} (cached)`);
      } else {
        console.log(`  [${done}/${refs.length}] ✓ ${label} (${data.attempts} attempt, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      }
    } else {
      failed++;
      failures.push({ label, error: data.error || data.reason });
      console.log(`  [${done + failed}/${refs.length}] ✗ ${label}: ${data.error || data.reason}`);
    }
  } catch (err) {
    failed++;
    failures.push({ label, error: err.message });
    console.log(`  [${done + failed}/${refs.length}] ✗ ${label}: ${err.message}`);
  }
}

// ─── 串行执行（或低并发） ──────────────────────────────────
console.log(`[batch] 开始生成，预计 ${Math.ceil(refs.length * 120 / 60)} 分钟 ...\n`);

if (concurrency <= 1) {
  for (const ref of refs) {
    var t0 = Date.now();
    await generate(ref);
  }
} else {
  // 简单分批并发
  for (let i = 0; i < refs.length; i += concurrency) {
    const batch = refs.slice(i, i + concurrency);
    const promises = batch.map((ref) => {
      var t0 = Date.now();
      return generate(ref);
    });
    await Promise.all(promises);
  }
}

// ─── 汇总 ─────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
console.log(`\n[batch] 完成！耗时 ${elapsed} 分钟`);
console.log(`  成功: ${done}（其中缓存: ${cached}）`);
console.log(`  失败: ${failed}`);
if (failures.length) {
  console.log("\n失败列表：");
  for (const f of failures) {
    console.log(`  - ${f.label}: ${f.error}`);
  }
}
