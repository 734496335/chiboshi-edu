import { access, readdir } from "node:fs/promises";
import path from "node:path";

// A packaging regression check: generated bundles must not carry local secrets
// or the historical deployment material. This never prints file contents.
const root = path.resolve(process.argv[2] ?? ".next/standalone");
await access(path.join(root, "server.js"));
const denied = [
  ".git", ".local", ".understand-anything", "llm_config.json",
  "scripts/deploy_helper.py", "chiboshi-standalone.zip", "docs",
  "尺博士", "猫啃什锦黑1.70", "_regen_logs",
];
const entries = await readdir(root);
const candidates = new Set([
  ...denied,
  ...entries.filter((name) => name.startsWith(".env") || /\.(zip|log)$/i.test(name)),
]);
const present = [];
for (const name of candidates) {
  try {
    await access(path.join(root, name));
    present.push(name);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
if (present.length) {
  console.error("Unsafe local material found in standalone output:", present.join(", "));
  process.exitCode = 1;
} else {
  console.log("Standalone package check passed: local credentials, history, operations, and archives are excluded.");
}
