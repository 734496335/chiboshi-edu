/**
 * scripts/_resolve-ref-icons.mts
 *
 * 内部辅助：导入所有 references + iconRegistry，对每个参考物 label 调用 pickIcon，
 * 把命中的 iconifyId 收集起来打印为 JSON 到 stdout，供 bake-icons.mjs 读取。
 *
 * 用 tsx 运行：`npx tsx scripts/_resolve-ref-icons.mts`
 *
 * 也会把 src/app/api/ai/parse/route.ts 里的 ICON_WHITELIST 包含进来，
 * 这样 AI 可能选的图标也会被烘焙。
 */
import {
  LENGTH_REFERENCES,
  AREA_REFERENCES,
  VOLUME_REFERENCES,
  CUBIC_REFERENCES,
  WEIGHT_REFERENCES,
  TIME_REFERENCES,
} from "../src/lib/references.js";
import { pickIcon } from "../src/lib/iconRegistry.js";

const all = [
  ...LENGTH_REFERENCES,
  ...AREA_REFERENCES,
  ...VOLUME_REFERENCES,
  ...CUBIC_REFERENCES,
  ...WEIGHT_REFERENCES,
  ...TIME_REFERENCES,
];

const ids = new Set<string>();
const misses: string[] = [];

for (const ref of all) {
  const r = pickIcon(ref.label);
  if (r.id) ids.add(r.id);
  else misses.push(ref.label);
}

// 同时尝试用 ref.id（英文）查一遍——有时候中文标签和英文 id 命中不同的图标
for (const ref of all) {
  const r = pickIcon(ref.id.replace(/_/g, " "));
  if (r.id) ids.add(r.id);
}

process.stdout.write(
  JSON.stringify(
    {
      ids: [...ids].sort(),
      misses,
    },
    null,
    0,
  ),
);
