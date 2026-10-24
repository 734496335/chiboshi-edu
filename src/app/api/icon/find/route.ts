/**
 * 图标查找 API
 *
 *   GET  /api/icon/find?q=学校
 *   POST /api/icon/find  body: { q: "学校" }
 *
 * 返回：{ id, collection, matchedTokens, candidates }
 *   id: Iconify ID，如 "openmoji:school"，无匹配时为 null
 *   candidates: 各集合命中的并列候选（前端可让用户选）
 */
import type { NextRequest } from "next/server";
import { pickIcon, pickIconCandidates } from "@/lib/iconRegistry";

export const runtime = "nodejs";

function handle(q: string) {
  const result = pickIcon(q);
  const candidates = pickIconCandidates(q);
  return Response.json({ ...result, candidates, query: q });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return Response.json({ error: "缺少 q 参数" }, { status: 400 });
  return handle(q);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { q?: string };
    const q = (body.q || "").trim();
    if (!q) return Response.json({ error: "缺少 q 字段" }, { status: 400 });
    return handle(q);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
