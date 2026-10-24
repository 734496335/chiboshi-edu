/**
 * scripts/bake-icons.mjs
 *
 * 把代码里用到的所有 Iconify 图标"烘焙"成本地静态 SVG，并把 viewBox 裁紧到真实可见像素的包围盒。
 *
 * 工作流：
 *   1. 扫描 src/ 抓出所有形如 "fluent-emoji:xxx" / "openmoji:xxx" 的字符串
 *   2. 对每个 id，从 @iconify-json/{set}/icons.json 取出 body
 *   3. 拼成完整 SVG → 用 @resvg/resvg-js 光栅化成 PNG（高分辨率）
 *   4. 像素扫描透明通道，找出非透明像素的 minX/minY/maxX/maxY
 *   5. 把像素坐标按比例映射回 SVG 用户单位，写入新的 viewBox
 *   6. 输出到 public/icons/iconify/{set}/{name}.svg
 *
 * 用法：
 *   node scripts/bake-icons.mjs           # 增量：已有文件跳过
 *   node scripts/bake-icons.mjs --force   # 强制重新烘焙所有
 *
 * 设计取舍：
 *   - 用像素扫描而不是 SVG 几何分析——可以正确处理带 mask/filter/gradient 的图标
 *   - 光栅化分辨率取 256（fluent-emoji 原 viewBox 32 → 8x 超采样），bbox 精度 ≈ 0.125 SVG 单位
 *   - 渲染失败的图标跳过并打印警告，不阻塞整体构建
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "public", "icons", "iconify");

const FORCE = process.argv.includes("--force");

// 支持的 icon set：除了从代码字面量里能扫出来的，运行时 iconRegistry
// 也会动态返回这些集合的 ID（mdi / game-icons），所以一并放进白名单。
// 注意：mdi / game-icons 的图标只有单色 path，bake 像素裁剪同样适用。
const SETS = {
  "fluent-emoji": "@iconify-json/fluent-emoji/icons.json",
  openmoji: "@iconify-json/openmoji/icons.json",
  mdi: "@iconify-json/mdi/icons.json",
  "game-icons": "@iconify-json/game-icons/icons.json",
};

// —— Step 1: 扫描代码 ——————————————————————————————————
async function scanSrcForIconIds() {
  const ids = new Set();
  const PREFIXES = Object.keys(SETS).join("|");
  const RE = new RegExp(`["'\\\`](${PREFIXES}):([a-z0-9][a-z0-9-]+)["'\\\`]`, "g");

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next") continue;
        await walk(p);
      } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(e.name)) {
        const text = await fs.readFile(p, "utf8");
        for (const m of text.matchAll(RE)) {
          ids.add(`${m[1]}:${m[2]}`);
        }
      }
    }
  }
  await walk(SRC_DIR);
  return [...ids].sort();
}

// —— Step 2: 加载 icon set ——————————————————————————————
const setCache = new Map();
function loadSet(prefix) {
  if (setCache.has(prefix)) return setCache.get(prefix);
  const mod = require(SETS[prefix]);
  setCache.set(prefix, mod);
  return mod;
}

// —— Step 3-5: 单图烘焙 ————————————————————————————————
async function bakeOne(id, Resvg) {
  const [prefix, name] = id.split(":");
  const set = loadSet(prefix);
  const icon = set.icons[name];
  if (!icon) {
    return { id, status: "missing" };
  }

  const w = icon.width ?? set.width ?? 24;
  const h = icon.height ?? set.height ?? 24;
  const body = icon.body;

  // 拼出原始 SVG
  const rawSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

  // 光栅化：把较长一边定到 256 像素
  const RENDER_PX = 256;
  const fit =
    w >= h
      ? { mode: "width", value: RENDER_PX }
      : { mode: "height", value: RENDER_PX };
  let pngPixels, pngW, pngH;
  try {
    const r = new Resvg(rawSvg, {
      fitTo: fit,
      background: "rgba(0,0,0,0)",
    });
    const img = r.render();
    pngPixels = img.pixels; // Uint8Array RGBA
    pngW = img.width;
    pngH = img.height;
  } catch (e) {
    return { id, status: "render-fail", error: String(e?.message || e) };
  }

  // 扫像素找 alpha > 8 的包围盒
  let minX = pngW,
    minY = pngH,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < pngH; y++) {
    const row = y * pngW * 4;
    for (let x = 0; x < pngW; x++) {
      if (pngPixels[row + x * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return { id, status: "empty" };
  }

  // 像素坐标 → SVG 用户坐标
  const sx = pngW / w;
  const sy = pngH / h;
  let vbx = minX / sx;
  let vby = minY / sy;
  let vbw = (maxX - minX + 1) / sx;
  let vbh = (maxY - minY + 1) / sy;
  // 防抗锯齿吃边
  const pad = Math.max(vbw, vbh) * 0.005;
  vbx -= pad;
  vby -= pad;
  vbw += pad * 2;
  vbh += pad * 2;
  // 数值收敛到 3 位小数，避免无意义浮点尾巴
  const f = (n) => Math.round(n * 1000) / 1000;

  // data-tight="1" 让运行时 InlineSvgFromUrl 知道无需再 getBBox 二次裁剪
  const tightSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="${f(vbx)} ${f(vby)} ${f(vbw)} ${f(vbh)}" ` +
    `preserveAspectRatio="xMidYMid meet" data-tight="1">${body}</svg>`;

  const outDir = path.join(OUT_DIR, prefix);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${name}.svg`);
  await fs.writeFile(outFile, tightSvg, "utf8");
  return { id, status: "ok", w, h, vbx, vby, vbw, vbh };
}

/**
 * 通过 iconRegistry 解析所有 references 的图标 ID。
 * 子进程跑 tsx，因为 iconRegistry 是 TS 且依赖打包的 JSON。
 */
function resolveRefIcons() {
  const resolverPath = path.join(__dirname, "_resolve-ref-icons.mts");
  // Windows 下 npx 是 .cmd，必须 shell:true。Linux/mac 直接执行就行。
  const r = spawnSync(`npx tsx "${resolverPath}"`, {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) {
    console.warn("[bake-icons] resolver 失败 (status=" + r.status + ")");
    console.warn("  stderr:", r.stderr?.slice(0, 500));
    console.warn("  stdout:", r.stdout?.slice(0, 500));
    return { ids: [], misses: [] };
  }
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    console.warn("[bake-icons] resolver 输出不是 JSON:");
    console.warn("  stdout 前 200 字符:", r.stdout?.slice(0, 200));
    console.warn("  err:", String(e));
    return { ids: [], misses: [] };
  }
}

// —— main ———————————————————————————————————————————————
async function main() {
  const { Resvg } = await import("@resvg/resvg-js");

  console.log("[bake-icons] 扫描 src/ 字面量 …");
  const scannedIds = await scanSrcForIconIds();
  console.log(`[bake-icons]   字面量命中 ${scannedIds.length} 个`);

  console.log("[bake-icons] 解析 references 通过 iconRegistry …");
  const { ids: registryIds, misses } = resolveRefIcons();
  console.log(
    `[bake-icons]   registry 命中 ${registryIds.length} 个，未命中 ${misses.length} 个 ref 标签`,
  );
  if (misses.length > 0) {
    console.log(
      `[bake-icons]   未命中标签（运行时会走 AI sketch 生成 SVG fallback）：${misses.slice(0, 8).join("、")}${misses.length > 8 ? " …" : ""}`,
    );
  }

  // 合并 + 去重，过滤掉 SETS 之外的 set（resolver 可能返回不在白名单里的）
  const allowedSets = new Set(Object.keys(SETS));
  const merged = new Set([...scannedIds, ...registryIds]);
  const ids = [...merged]
    .filter((id) => {
      const colon = id.indexOf(":");
      return colon > 0 && allowedSets.has(id.slice(0, colon));
    })
    .sort();
  console.log(`[bake-icons] 合并去重后共 ${ids.length} 个 iconify ID 待处理`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  // 增量：跳过已存在（除非 --force）
  const todo = [];
  for (const id of ids) {
    const [prefix, name] = id.split(":");
    const out = path.join(OUT_DIR, prefix, `${name}.svg`);
    if (!FORCE) {
      try {
        await fs.access(out);
        continue;
      } catch {
        // 不存在 → 需要烘焙
      }
    }
    todo.push(id);
  }
  console.log(
    `[bake-icons] 待烘焙 ${todo.length} 个${FORCE ? "（--force 模式）" : "（增量）"}`,
  );

  const stats = { ok: 0, missing: 0, "render-fail": 0, empty: 0 };
  for (let i = 0; i < todo.length; i++) {
    const id = todo[i];
    const r = await bakeOne(id, Resvg);
    stats[r.status]++;
    if (r.status !== "ok") {
      console.warn(
        `  [${r.status}] ${id}${r.error ? " — " + r.error : ""}`,
      );
    }
    if ((i + 1) % 20 === 0 || i === todo.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${todo.length}]`);
    }
  }
  process.stdout.write("\n");

  // 生成清单
  const manifest = {
    bakedAt: new Date().toISOString(),
    total: ids.length,
    stats,
    ids,
  };
  await fs.writeFile(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  console.log("[bake-icons] 完成", stats);
}

main().catch((e) => {
  console.error("[bake-icons] 失败:", e);
  process.exit(1);
});
