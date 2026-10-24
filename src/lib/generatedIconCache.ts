/**
 * 生成的 SVG 简笔画缓存
 *
 * 设计：每个唯一物体名（slug 化后）只调一次 LLM，结果落盘到
 *   public/icons/generated/{hash}.svg
 * 后续请求直接返回 URL（前端 <img src="/icons/generated/{hash}.svg">）。
 *
 * slug 策略：把中文/英文转成 base32 hash 前 12 字符——避免文件名特殊字符问题。
 *
 * ⚠️ 在 Vercel/Lambda 这类只读 fs 部署上要切到 KV/Blob 存储。详见 docs/DEPLOY_TODO.md。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** 项目根目录下的缓存文件夹 */
const CACHE_DIR = path.join(process.cwd(), "public", "icons", "generated");
/** 浏览器访问路径前缀 */
export const PUBLIC_URL_PREFIX = "/icons/generated";

export function slugify(input: string): string {
  const normalized = input.trim().toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return hash;
}

export async function readCache(slug: string): Promise<string | null> {
  try {
    const file = path.join(CACHE_DIR, `${slug}.svg`);
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}

export async function writeCache(slug: string, svg: string): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${slug}.svg`);
  await fs.writeFile(file, svg, "utf-8");
}

export function publicUrlFor(slug: string): string {
  return `${PUBLIC_URL_PREFIX}/${slug}.svg`;
}
