/**
 * 图标查找服务（仅服务端）
 *
 * 职责：给定中文/英文物体名，按优先级在 OpenMoji / Game-Icons / MDI
 * 三个图标集合里搜索最匹配的图标，返回 Iconify ID（如 "openmoji:bridge-at-night"）。
 *
 * 优先级：openmoji > game-icons > mdi
 * （第 4 档 OpenMoji-Black 由前端通过 CSS grayscale 过滤实现，无需服务端介入）
 *
 * 仅在 Node 服务端使用——这些 JSON 包总计 ~40MB，前端不能直接 bundle。
 */
import type { IconifyJSON } from "@iconify/types";
import openmojiData from "@iconify-json/openmoji/icons.json";
import gameIconsData from "@iconify-json/game-icons/icons.json";
import mdiData from "@iconify-json/mdi/icons.json";
import { chineseToTokens } from "./zhAliases";

type CollectionId = "openmoji" | "game-icons" | "mdi";

interface IconEntry {
  collection: CollectionId;
  name: string;
  /** 拆词后的小写 token，例如 "bridge-at-night" → ["bridge","at","night"] */
  tokens: string[];
}

const PRIORITY: CollectionId[] = ["openmoji", "game-icons", "mdi"];

/** 一次性预构建的搜索索引（按集合分桶） */
const INDEX: Record<CollectionId, IconEntry[]> = {
  openmoji: buildIndex("openmoji", openmojiData as IconifyJSON),
  "game-icons": buildIndex("game-icons", gameIconsData as IconifyJSON),
  mdi: buildIndex("mdi", mdiData as IconifyJSON),
};

function buildIndex(collection: CollectionId, data: IconifyJSON): IconEntry[] {
  const names = new Set<string>(Object.keys(data.icons));
  // aliases 也要进索引（指向同一个真实图标，但允许通过别名搜到）
  if (data.aliases) {
    for (const alias of Object.keys(data.aliases)) names.add(alias);
  }
  return Array.from(names).map((name) => ({
    collection,
    name,
    tokens: name.toLowerCase().split(/[-_]+/).filter(Boolean),
  }));
}

/**
 * 在单个集合里搜索匹配项。
 *
 * 策略：**按 query token 顺序逐个尝试**——alias 数组里靠前的 token
 * 是首选语义，先用它找；找不到再试第二个。这样 ZH_ALIASES 的写作顺序
 * 直接决定优先级。
 *
 * 单 token 内的评分：
 *   +5  exact match：图标名 === q
 *   +3  分词相同：name 的某 token === q
 *   +1  prefix 命中
 *   并列时偏向 token 数少（更精确）的图标
 */
function searchByOneToken(
  entries: IconEntry[],
  q: string,
): IconEntry | null {
  let bestEntry: IconEntry | null = null;
  let bestScore = 0;
  for (const entry of entries) {
    let score = 0;
    if (entry.name.toLowerCase() === q) score += 5;
    if (entry.tokens.includes(q)) score += 3;
    else if (entry.tokens.some((t) => t.startsWith(q))) score += 1;
    if (score === 0) continue;
    if (
      score > bestScore ||
      (score === bestScore &&
        bestEntry &&
        entry.tokens.length < bestEntry.tokens.length)
    ) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  return bestEntry;
}

function searchInCollection(
  entries: IconEntry[],
  queryTokens: string[],
): string | null {
  for (const q of queryTokens) {
    const hit = searchByOneToken(entries, q.toLowerCase());
    if (hit) return hit.name;
  }
  return null;
}

export interface IconLookupResult {
  /** 完整 Iconify ID，如 "openmoji:bridge-at-night"；失败时为 null */
  id: string | null;
  collection: CollectionId | null;
  /** 命中的英文关键词，便于调试 */
  matchedTokens: string[];
}

/**
 * 主入口：按优先级搜，命中就返回。
 *
 * @param query 用户输入的物体名，中英文都可
 * @param opts.preferCollection 强制限定集合（可选）
 */
export function pickIcon(
  query: string,
  opts: { preferCollection?: CollectionId } = {},
): IconLookupResult {
  const tokens = chineseToTokens(query);
  if (tokens.length === 0) {
    return { id: null, collection: null, matchedTokens: [] };
  }

  const order: CollectionId[] = opts.preferCollection
    ? [
        opts.preferCollection,
        ...PRIORITY.filter((c) => c !== opts.preferCollection),
      ]
    : PRIORITY;

  for (const col of order) {
    const name = searchInCollection(INDEX[col], tokens);
    if (name) {
      return {
        id: `${col}:${name}`,
        collection: col,
        matchedTokens: tokens,
      };
    }
  }
  return { id: null, collection: null, matchedTokens: tokens };
}

/**
 * pickIcon 失败时调 AI 生 SVG 的 fallback。
 *
 * 服务端使用：先 pickIcon，没命中就调 /api/ai/sketch（带 QA 流水线）。
 * 注意：本函数会发起内部 HTTP（baseUrl 由调用方决定），慢路径耗时 3-15s。
 *
 * @returns 命中库 → "{collection}:{name}"；走生成 → "generated:{slug}"；都失败 → null
 */
export async function pickIconWithSketchFallback(
  query: string,
  opts: {
    /** 内部 fetch 的基址，默认从环境变量推。本地开发可传 http://localhost:3000 */
    baseUrl?: string;
    /** 生成超时（默认 35 秒，覆盖 3 次重试 + 网络） */
    timeoutMs?: number;
  } = {},
): Promise<{ id: string | null; source: "library" | "generated" | "miss" }> {
  const lib = pickIcon(query);
  if (lib.id) return { id: lib.id, source: "library" };

  const baseUrl =
    opts.baseUrl ||
    process.env.INTERNAL_BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 35_000);
  try {
    const res = await fetch(`${baseUrl}/api/ai/sketch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object: query }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { id: null, source: "miss" };
    const data = (await res.json()) as { id?: string };
    return data.id ? { id: data.id, source: "generated" } : { id: null, source: "miss" };
  } catch {
    return { id: null, source: "miss" };
  } finally {
    clearTimeout(t);
  }
}

/**
 * 多候选返回（用于调试 / 让 UI 给用户选）
 */
export function pickIconCandidates(
  query: string,
  perCollectionLimit = 1,
): Array<{ id: string; collection: CollectionId }> {
  const tokens = chineseToTokens(query);
  if (tokens.length === 0) return [];

  const out: Array<{ id: string; collection: CollectionId }> = [];
  for (const col of PRIORITY) {
    let count = 0;
    const name = searchInCollection(INDEX[col], tokens);
    if (name) {
      out.push({ id: `${col}:${name}`, collection: col });
      count++;
    }
    if (count >= perCollectionLimit) continue;
  }
  return out;
}
