/**
 * /dev/icons — 「造物小工坊」(面向儿童)
 *
 * 这个路由原本是开发用的 QA 页（标记 / 重生 / 看孤儿 PNG）。
 * 改造后面向儿童：保留服务端读盘逻辑，把客户端 UI 切到 KidStudio。
 *
 * 数据：
 *   scripts/pixel-bake/visual-assets.json   全部目录（id/label/category/prompt）
 *   public/icons/pixel/*.png                实际已烘焙好的 PNG
 *
 * 仅返回"已生成"的物品供画廊展示。"待生成 / 孤儿 PNG"等运维信息
 * 留给开发者用（如需复用 IconQa，新建 /dev/icons-qa 路由即可）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { KidStudio } from "./KidStudio";
import type { IconItem } from "./IconQa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CatalogEntry {
  id: string;
  label: string;
  aliases?: string[];
  category: string;
  axis?: string;
  prompt?: string;
}

async function loadData(): Promise<{
  groups: Array<{ category: string; items: IconItem[] }>;
  categories: string[];
}> {
  const root = process.cwd();
  const catalogPath = path.join(
    root,
    "scripts",
    "pixel-bake",
    "visual-assets.json",
  );
  const pngDir = path.join(root, "public", "icons", "pixel");

  const [catalogRaw, pngFiles] = await Promise.all([
    fs.readFile(catalogPath, "utf8"),
    fs
      .readdir(pngDir)
      .then((files) => files.filter((f) => f.endsWith(".png")))
      .catch(() => [] as string[]),
  ]);
  const catalog = JSON.parse(catalogRaw) as CatalogEntry[];
  const pngSet = new Set(pngFiles.map((f) => f.replace(/\.png$/, "")));

  const have: IconItem[] = [];
  for (const entry of catalog) {
    if (pngSet.has(entry.id)) {
      have.push({
        id: entry.id,
        label: entry.label,
        category: entry.category,
        prompt: entry.prompt,
        url: `/icons/pixel/${entry.id}.png`,
      });
    }
  }

  const byCat = new Map<string, IconItem[]>();
  for (const item of have) {
    const arr = byCat.get(item.category) ?? [];
    arr.push(item);
    byCat.set(item.category, arr);
  }
  const groups = Array.from(byCat.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.items.length - a.items.length);

  const categories = Array.from(
    new Set(catalog.map((e) => e.category).filter(Boolean)),
  ).sort();

  return { groups, categories };
}

export default async function KidStudioPage() {
  const { groups, categories } = await loadData();
  return <KidStudio groups={groups} categories={categories} />;
}
