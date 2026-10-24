/**
 * 把所有 references dump 成 refs.json，供 bake.py 读取。
 *
 * 用 tsx 运行：`npx tsx scripts/pixel-bake/_dump-refs.mts > scripts/pixel-bake/refs.json`
 */
import {
  LENGTH_REFERENCES,
  AREA_REFERENCES,
  VOLUME_REFERENCES,
  CUBIC_REFERENCES,
  WEIGHT_REFERENCES,
  TIME_REFERENCES,
} from "../../src/lib/references.js";

const all = [
  ...LENGTH_REFERENCES.map((r) => ({ ...r, _group: "length" })),
  ...AREA_REFERENCES.map((r) => ({ ...r, _group: "area" })),
  ...VOLUME_REFERENCES.map((r) => ({ ...r, _group: "volume" })),
  ...CUBIC_REFERENCES.map((r) => ({ ...r, _group: "cubic" })),
  ...WEIGHT_REFERENCES.map((r) => ({ ...r, _group: "weight" })),
  ...TIME_REFERENCES.map((r) => ({ ...r, _group: "time" })),
];

const out = all.map((r) => ({
  id: r.id,
  label: r.label,
  group: r._group,
  size: r.size,
  unit: r.unit,
  axis: r.axis,
  hainan: r.hainan,
  category: r.category,
  notes: r.notes,
}));

process.stdout.write(JSON.stringify(out, null, 2));
