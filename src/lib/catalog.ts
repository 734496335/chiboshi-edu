/**
 * 服务端 catalog 加载器（仅 Node runtime 可用）
 *
 * `scripts/pixel-bake/visual-assets.json` 是图像宇宙的唯一元数据源。
 * 它和 `public/icons/pixel/<id>.png` 一一对应。
 *
 * 设计决策：
 *   - 不维护尺寸字段——尺寸是上下文相关的（卡车长度 vs 卡车高度），由 AI 每次请求时给。
 *   - 简单 mtime 缓存：JSON 改动后自动重新读盘，避免每次请求都 IO。
 *   - 提供按 axis 预过滤的便捷查询，控制 AI prompt 大小。
 */
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface CatalogEntry {
  id: string;
  label: string;
  aliases?: string[];
  category: string;
  axis?: "horizontal" | "vertical" | "either" | "square";
  prompt?: string;
}

interface CatalogCache {
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  pngIds: Set<string>;
  jsonMtimeMs: number;
  pngDirMtimeMs: number;
}

let cachePromise: Promise<CatalogCache> | null = null;

function projectRoot(): string {
  return process.cwd();
}

function catalogJsonPath(): string {
  return path.join(
    projectRoot(),
    "scripts",
    "pixel-bake",
    "visual-assets.json",
  );
}

function pngDirPath(): string {
  return path.join(projectRoot(), "public", "icons", "pixel");
}

async function loadFresh(): Promise<CatalogCache> {
  const jsonPath = catalogJsonPath();
  const pngDir = pngDirPath();
  const [jsonStat, pngStat] = await Promise.all([
    fs.stat(jsonPath),
    fs.stat(pngDir).catch(() => null),
  ]);
  const [raw, pngFiles] = await Promise.all([
    fs.readFile(jsonPath, "utf8"),
    fs.readdir(pngDir).catch(() => [] as string[]),
  ]);
  const entries = JSON.parse(raw) as CatalogEntry[];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pngIds = new Set(
    pngFiles
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(/\.png$/, "")),
  );
  return {
    entries,
    byId,
    pngIds,
    jsonMtimeMs: jsonStat.mtimeMs,
    pngDirMtimeMs: pngStat?.mtimeMs ?? 0,
  };
}

async function getCache(): Promise<CatalogCache> {
  if (!cachePromise) {
    cachePromise = loadFresh();
    return cachePromise;
  }
  // 若 JSON 或 PNG 目录变更，刷新
  const current = await cachePromise;
  try {
    const [j, p] = await Promise.all([
      fs.stat(catalogJsonPath()),
      fs.stat(pngDirPath()).catch(() => null),
    ]);
    if (
      j.mtimeMs !== current.jsonMtimeMs ||
      (p?.mtimeMs ?? 0) !== current.pngDirMtimeMs
    ) {
      cachePromise = loadFresh();
      return cachePromise;
    }
  } catch {
    /* 失败时复用旧缓存 */
  }
  return current;
}

/** 失效缓存——bake-on-demand 写入 catalog 后调用，确保下一次读取拿到新条目。 */
export function invalidateCatalogCache(): void {
  cachePromise = null;
}

/**
 * 把新条目原子追加进 visual-assets.json。同 id 已存在则不重复写。
 * 返回 added=true 表示真正写入（catalog 长大了）。
 */
export async function appendCatalogEntry(
  entry: CatalogEntry,
): Promise<{ added: boolean }> {
  const jsonPath = catalogJsonPath();
  const raw = await fs.readFile(jsonPath, "utf8");
  const arr = JSON.parse(raw) as CatalogEntry[];
  if (arr.some((e) => e.id === entry.id)) return { added: false };
  arr.push(entry);
  const tmp = jsonPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(arr, null, 2) + "\n", "utf8");
  await fs.rename(tmp, jsonPath);
  invalidateCatalogCache();
  return { added: true };
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  return (await getCache()).entries;
}

export async function getCatalogEntry(
  id: string,
): Promise<CatalogEntry | undefined> {
  return (await getCache()).byId.get(id);
}

/**
 * 按"名称"在 catalog 中匹配条目（label 或 aliases，中文/英文皆可）。
 * 仅返回 **PNG 已存在** 的条目——这样调用方可以直接拿来当 iconId 用。
 *
 * 匹配策略：归一化（lowercase + 去空白）后做 equals / includes 双向匹配，
 * 取最长 label 命中（避免 "苹果" 同时命中 "苹果" 和 "苹果手机" 时优先精确）。
 *
 * 用例：weight 维度 AI 返回 `apple_weight` 这种"维度后缀 id"时，
 * 优先用 catalog 里干净的 `apple` PNG 替换它。
 */
export async function findCatalogEntryByName(
  name: string,
): Promise<CatalogEntry | undefined> {
  const q = name.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return undefined;
  const c = await getCache();
  let best: CatalogEntry | undefined;
  let bestScore = -1;
  for (const e of c.entries) {
    if (!c.pngIds.has(e.id)) continue;
    const candidates = [e.label, ...(e.aliases ?? [])].map((s) =>
      s.trim().toLowerCase().replace(/\s+/g, ""),
    );
    for (const cand of candidates) {
      if (!cand) continue;
      // 精确匹配最优；其次是双向 includes
      let score = -1;
      if (cand === q) score = 1000 + cand.length;
      else if (q.includes(cand)) score = 100 + cand.length;
      else if (cand.includes(q)) score = 50 + q.length;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
  }
  return best;
}

export async function hasPng(id: string): Promise<boolean> {
  return (await getCache()).pngIds.has(id);
}

/**
 * 「可用条目」= JSON 有 + PNG 有。AI 只能从这个池子里挑。
 */
export async function getAvailable(): Promise<CatalogEntry[]> {
  const c = await getCache();
  return c.entries.filter((e) => c.pngIds.has(e.id));
}

/**
 * 长度维度可用条目按 axis 预过滤。
 *   - horizontal 模式：horizontal + either + square
 *   - vertical   模式：vertical   + either + square
 */
export async function getAvailableForLengthAxis(
  axis: "horizontal" | "vertical",
): Promise<CatalogEntry[]> {
  const list = await getAvailable();
  return list.filter((e) => {
    const a = e.axis ?? "horizontal";
    if (a === "either" || a === "square") return true;
    return a === axis;
  });
}

/**
 * 把 catalog entry 序列化成给 LLM 看的紧凑一行：
 *   id (label, axis, aliases: a/b/c)
 * aliases 仅在存在时附上，省 token。
 */
export function entryToLlmLine(e: CatalogEntry): string {
  const axis = e.axis ?? "horizontal";
  const aliasPart =
    e.aliases && e.aliases.length > 0 ? ` aka:${e.aliases.join("/")}` : "";
  return `${e.id} (${e.label}, ${axis}${aliasPart})`;
}
