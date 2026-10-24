import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/api/llm-config/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

// Execute the actual route with real Request/NextResponse objects, synthetic
// credentials, and an in-memory settings file. No real user config is touched.
function instance(local, env = {}) {
  let disk = local === undefined ? undefined : JSON.stringify(local);
  let writes = 0;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require(id) {
      if (id === "node:fs") return { promises: {
        async readFile() {
          if (disk === undefined) throw new Error("missing test config");
          return disk;
        },
        async writeFile(_path, value) { disk = value; writes += 1; },
      } };
      return require(id);
    },
    process: { cwd: () => "/synthetic-chiboshi-instance", env },
    URL, Request, Response,
  }, { filename: "llm-config.route.cjs" });
  return {
    ...testModule.exports,
    saved: () => disk === undefined ? undefined : JSON.parse(disk),
    writes: () => writes,
  };
}

const original = {
  apiKey: "dummy-secret-for-regression-tests",
  baseUrl: "https://old-provider.example/v1",
  model: "example-model",
};
function post(body, origin = "http://127.0.0.1:3000") {
  return new Request("http://127.0.0.1:3000/api/llm-config", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

test("GET excludes keys and unknown stored fields and disables caching", async () => {
  const app = instance({ ...original, unrelatedSecret: "private-extra-field" });
  const response = await app.GET();
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(!text.includes(original.apiKey));
  assert.ok(!text.includes("private-extra-field"));
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body.config).sort(), ["baseUrl", "hasKey", "maskedKey", "model"]);
  assert.equal(body.config.maskedKey, "********");
});

test("GET recognizes environment credentials without serializing them", async () => {
  const app = instance(undefined, { LLM_API_KEY: original.apiKey, LLM_BASE_URL: original.baseUrl, LLM_MODEL: original.model });
  const response = await app.GET();
  const body = await response.json();
  assert.equal(body.config.hasKey, true);
  assert.equal(body.config.baseUrl, original.baseUrl);
  assert.ok(!JSON.stringify(body).includes(original.apiKey));
});

test("blank and explicit keep markers preserve the existing provider key", async () => {
  for (const apiKey of ["", "____KEEP_EXISTING____"]) {
    const app = instance(original);
    assert.equal((await app.POST(post({ apiKey, baseUrl: original.baseUrl + "/", model: "changed-model" }))).status, 200);
    assert.equal(app.saved().apiKey, original.apiKey);
    assert.equal(app.saved().model, "changed-model");
  }
});

test("changing provider cannot silently reuse its predecessor's key", async () => {
  const app = instance(original);
  assert.equal((await app.POST(post({ apiKey: "", baseUrl: "https://new-provider.example/v1" }))).status, 400);
  assert.equal(app.writes(), 0);
  assert.equal(app.saved().apiKey, original.apiKey);
});

test("changing provider with a replacement key succeeds", async () => {
  const app = instance(original);
  assert.equal((await app.POST(post({ apiKey: "dummy-replacement-secret", baseUrl: "https://new-provider.example/v1" }))).status, 200);
  assert.equal(app.saved().apiKey, "dummy-replacement-secret");
  assert.equal(app.saved().baseUrl, "https://new-provider.example/v1");
});

test("invalid request bodies and credential-bearing URLs are rejected without writes", async () => {
  for (const body of [
    null, [], "text", { apiKey: 12 }, { model: null },
    { baseUrl: "file:///tmp/model" },
    { baseUrl: "https://user:password@example.test/v1" },
    { baseUrl: "https://example.test/v1?key=dummy" },
    { baseUrl: "https://example.test/v1#fragment" },
  ]) {
    const app = instance(original);
    assert.equal((await app.POST(post(body))).status, 400);
    assert.equal(app.writes(), 0);
  }
});

test("cross-origin browser writes are rejected", async () => {
  const app = instance(original);
  assert.equal((await app.POST(post({ model: "changed" }, "https://unrelated.example"))).status, 403);
  assert.equal(app.writes(), 0);
});

test("a new provider and key can repair an invalid legacy base URL", async () => {
  const app = instance({ ...original, baseUrl: "not-a-url" });
  assert.equal((await app.POST(post({ apiKey: "dummy-replacement-secret", baseUrl: "http://127.0.0.1:8000/v1" }))).status, 200);
  assert.equal(app.saved().baseUrl, "http://127.0.0.1:8000/v1");
});
