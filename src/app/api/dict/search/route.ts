/**
 * /api/dict/search?dim=length&q=蓝鲸
 *
 * 量感字典的"任意搜索"端点：
 *   - 主数据源：references.ts（提供 size + sizeDisplay）
 *   - 视觉资产：catalog（visual-assets.json）按 label/aliases 模糊匹配，未命中则不返回（避免破图）
 *
 * 返回最多 8 条命中，按尺寸升序。每条结构与字典精选卡兼容（含 catalogId / sizeText / sizeM）。
 */
import { NextRequest, NextResponse } from "next/server";
import { ALL_REFERENCES } from "@/lib/references";
import { findCatalogEntryByName, getAvailable } from "@/lib/catalog";
import type { DimensionKey } from "@/lib/dimensions";

export const runtime = "nodejs";

interface SearchHit {
  /** 候选物品 id（catalog 优先；catalog 无则用 reference id） */
  id: string;
  catalogId: string | null;
  label: string;
  sizeText: string;
  sizeM: number;
  /** 来源调试用（catalog / reference） */
  source: "catalog" | "reference";
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function scoreMatch(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return -1;
  if (c === q) return 1000 + c.length;
  if (c.startsWith(q)) return 500 + c.length - (c.length - q.length);
  if (q.includes(c)) return 200 + c.length;
  if (c.includes(q)) return 100 + q.length;
  return -1;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const dim = (searchParams.get("dim") ?? "length") as DimensionKey;
  if (!q) return NextResponse.json({ hits: [] });

  const hits: Array<SearchHit & { score: number }> = [];

  // ① 维度内的 references（带 size 的权威数据）
  const refs = ALL_REFERENCES.filter((r) => r.dimension === dim);
  for (const r of refs) {
    const labels = [r.label, ...(r.notes ? [r.notes] : [])];
    const score = Math.max(...labels.map((l) => scoreMatch(q, l)));
    if (score < 0) continue;
    const catHit = await findCatalogEntryByName(r.label);
    hits.push({
      id: r.id,
      catalogId: catHit?.id ?? null,
      label: r.label,
      sizeText: r.sizeDisplay,
      sizeM: r.size,
      source: "reference",
      score,
    });
  }

  // ② 同时直接扫 catalog 的 label/aliases，
  //    抓那些 references 没收录但 catalog 有的物品（例如孩子查"考拉"，没尺寸但有图）
  //    —— 没尺寸数据就跳过，不显示残卡。
  const seen = new Set(hits.map((h) => normalize(h.label)));
  const catalog = await getAvailable();
  for (const e of catalog) {
    const candidates = [e.label, ...(e.aliases ?? [])];
    let bestScore = -1;
    for (const cand of candidates) {
      bestScore = Math.max(bestScore, scoreMatch(q, cand));
    }
    if (bestScore < 0) continue;
    if (seen.has(normalize(e.label))) continue;
    // catalog 自身没有 size——尝试在 references.ts 找同名条目复用尺寸
    const sized = refs.find(
      (r) =>
        normalize(r.label) === normalize(e.label) ||
        e.aliases?.some((a) => normalize(a) === normalize(r.label)),
    );
    if (!sized) continue; // 没尺寸数据的物品不进字典搜索结果
    hits.push({
      id: e.id,
      catalogId: e.id,
      label: e.label,
      sizeText: sized.sizeDisplay,
      sizeM: sized.size,
      source: "catalog",
      score: bestScore,
    });
    seen.add(normalize(e.label));
  }

  // 排序：分数降序 → 尺寸升序（便于孩子看到由小到大）
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sizeM - b.sizeM;
  });

  return NextResponse.json({
    hits: hits.slice(0, 8).map(({ score: _s, ...rest }) => rest),
  });
}
