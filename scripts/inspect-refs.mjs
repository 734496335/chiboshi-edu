// 临时脚本：打印各维度参考物覆盖情况，用于分析稀疏区段
// 用 tsx 直接跑：`npx tsx scripts/inspect-refs.mjs`
const m = await import("../src/lib/references.ts");

const dump = (arr) =>
  arr
    .slice()
    .sort((a, b) => a.size - b.size)
    .map(
      (r) =>
        `  ${String(r.size).padStart(10)} ${(r.unit || "").padEnd(4)}  ${r.label}${
          r.axis ? "  [" + r.axis + "]" : ""
        }`,
    )
    .join("\n");

const groups = {
  LENGTH: m.LENGTH_REFERENCES,
  AREA: m.AREA_REFERENCES,
  VOLUME: m.VOLUME_REFERENCES,
  CUBIC: m.CUBIC_REFERENCES,
  WEIGHT: m.WEIGHT_REFERENCES,
  TIME: m.TIME_REFERENCES,
};

for (const [name, arr] of Object.entries(groups)) {
  console.log(`\n=== ${name} (${arr.length}) ===`);
  console.log(dump(arr));
}
