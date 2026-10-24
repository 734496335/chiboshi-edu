/**
 * Capture genuine local UI interactions and compose editorial media cards.
 * Optional tool: npm exec --package=playwright -- node scripts/media/capture.mjs
 * Run the application without provider credentials. No responses are mocked.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const bin = (process.env.PATH || "").split(path.delimiter).find(p =>
  fs.existsSync(path.join(p, "playwright.cmd")) || fs.existsSync(path.join(p, "playwright")));
const { chromium } = bin ? require(path.resolve(bin, "..", "playwright")) : require("playwright");
const base = process.env.MEDIA_BASE_URL || "http://127.0.0.1:3000";
const work = ".local/media-20261024";
const output = "docs/media";
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(output, { recursive: true });
const manifest = {
  capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  viewport: { width: 1440, height: 900 },
  interfaceLanguage: "zh-CN",
  walkthroughLanguage: "en",
  providerConfigured: false,
  responseInterception: false,
  scenes: [],
  comparisons: [],
  pageErrors: [],
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const dataImage = filename => "data:image/png;base64," + fs.readFileSync(filename).toString("base64");

async function scene(id, route, run) {
  const context = await browser.newContext({
    viewport: manifest.viewport, locale: "en-US", reducedMotion: "reduce",
    recordVideo: { dir: work, size: manifest.viewport },
  });
  await context.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const cursor = document.createElement("div");
      cursor.setAttribute("data-recording-pointer", "");
      cursor.style.cssText = "position:fixed;width:14px;height:14px;border:2px solid #342d28;border-radius:50%;background:#ffbf47;pointer-events:none;z-index:2147483647;left:-50px;top:-50px;box-shadow:0 0 0 5px #ffffff88";
      document.body.append(cursor);
      addEventListener("mousemove", e => { cursor.style.left = e.clientX - 7 + "px"; cursor.style.top = e.clientY - 7 + "px"; });
      addEventListener("mousedown", () => cursor.animate([{transform:"scale(1)"},{transform:"scale(2)"},{transform:"scale(1)"}], {duration:380}));
    });
  });
  const epoch = Date.now();
  const page = await context.newPage();
  page.on("pageerror", error => manifest.pageErrors.push(error.message));
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  const start = (Date.now() - epoch) / 1000;
  await run(page);
  const duration = (Date.now() - epoch) / 1000 - start;
  const video = page.video();
  await context.close();
  const raw = path.join(work, id + ".webm");
  await video.saveAs(raw);
  manifest.scenes.push({ id, route, start, duration, raw });
}
async function moveTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Capture target has no visible bounds");
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 24 });
  await pause(450);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(work, name + ".png") });
}
async function compare(page, act) {
  const pending = page.waitForResponse(r => r.url().endsWith("/api/ai/parse") && r.request().method() === "POST", { timeout: 45000 });
  await act();
  const response = await pending;
  const value = await response.json();
  if (!response.ok() || value.source !== "fallback") throw new Error("The no-key comparison did not use the real fallback");
  if (value.owl_quip.includes("差不多就这么大")) throw new Error("Unverified measurement was falsely endorsed");
  manifest.comparisons.push({
    source: value.source, object: value.object, value: value.value, unit: value.unit,
    valueInSi: value.value_in_si, feedback: value.owl_quip,
    references: value.resolved_refs.map(r => ({ label:r.label, value:r.size, unit:r.unit })),
  });
  await page.waitForTimeout(1800);
}

try {
  const config = await (await fetch(base + "/api/llm-config")).json();
  if (!config.success || config.config.hasKey) throw new Error("Use a clean local server without provider credentials for this walkthrough");

  await scene("01-home", "/", async page => {
    await shot(page, "home");
    await pause(1800);
    const link = page.locator('a[href="/play/length/dictionary"]');
    await moveTo(page, link);
    await pause(1000);
    await link.click();
    await page.waitForURL("**/play/length/dictionary");
    await pause(1400);
  });
  await scene("02-reference", "/play/length/dictionary", async page => {
    const mm = page.locator('a[href="#scale-mm"]');
    await moveTo(page, mm); await mm.click(); await pause(900);
    await shot(page, "reference");
    await pause(4000);
    const cm = page.locator('a[href="#scale-10cm"]');
    await moveTo(page, cm); await cm.click(); await pause(3800);
  });
  await scene("03-compare", "/play/length/sandbox", async page => {
    const preset = page.getByRole("button", { name: /蚂蚁长 5 米/ });
    await moveTo(page, preset); await pause(700);
    await compare(page, () => preset.click());
    await shot(page, "estimate");
    await pause(4200);
    const input = page.locator("input").first();
    await moveTo(page, input);
    await input.fill("蚂蚁长 5 毫米");
    await pause(900);
    await compare(page, () => input.press("Enter"));
    await shot(page, "revised");
    await pause(4500);
  });
  await scene("04-capacity", "/play/volume/dictionary", async page => {
    const litres = page.locator('a[href="#scale-l"]');
    await moveTo(page, litres); await litres.click(); await pause(1000);
    await shot(page, "capacity");
    await pause(6000);
  });

  if (manifest.comparisons[0].valueInSi !== 5 || manifest.comparisons[1].valueInSi !== 0.005) throw new Error("Unit conversion in the captured comparison is incorrect");
  if (manifest.pageErrors.length) throw new Error("Browser runtime errors occurred");

  const composer = await browser.newPage();
  async function render(filename, width, height, body) {
    await composer.setViewportSize({ width, height });
    await composer.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box} html,body{margin:0;width:100%;height:100%;overflow:hidden}
      body{font-family:"Segoe UI",Arial,sans-serif;background:#fff8e8;color:#3e3128}
      .eyebrow{font-size:19px;font-weight:750;letter-spacing:3px;text-transform:uppercase}
      .muted{color:#776c60}.pill{display:inline-block;border:1px solid #dfd2b6;border-radius:30px;padding:10px 18px;font-size:18px;font-weight:650;background:#fffdf6}
      .mono{font-family:Consolas,monospace} img{object-fit:contain}
      </style></head><body>${body}</body></html>`);
    await composer.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    await composer.screenshot({ path: filename });
  }
  const owl = dataImage("public/ip3.png");
  await render(output + "/cover.png", 1280, 640, `
    <div style="position:absolute;inset:24px;border:1px solid #dfd2b6;border-radius:24px"></div>
    <div style="position:absolute;left:64px;top:65px;width:710px">
      <div class="eyebrow" style="color:#258c86">CHIBOSHI · OPEN EDUCATION</div>
      <h1 style="font-size:76px;line-height:1.04;letter-spacing:-3px;margin:28px 0 23px;font-weight:800">Make measurement<br><span style="color:#e89129">make sense.</span></h1>
      <p style="font-size:28px;line-height:1.4;margin:0 0 30px">Estimate. Compare. Explain.</p>
      <div style="display:flex;gap:10px"><span class="pill">6 dimensions</span><span class="pill">Run locally</span><span class="pill">MIT source</span></div>
      <p class="muted" style="font-size:18px;margin-top:37px">English guides · Chinese activities · Independent maintenance</p>
      <p class="mono" style="font-size:17px;margin-top:20px">github.com/734496335/chiboshi-edu</p>
    </div>
    <div style="position:absolute;right:55px;top:115px;width:360px;height:380px;border-radius:48%;background:#d8eee5;transform:rotate(-8deg)"></div>
    <img src="${owl}" style="position:absolute;right:37px;top:84px;width:410px;height:430px">
    <div style="position:absolute;right:88px;bottom:88px;font-size:20px;font-weight:700;color:#258c86">A playground for curious minds.</div>
  `);
  const cards = [
    ["01-reference","reference","01 / FIND A REFERENCE","Start small. Build a sense of scale.","The built-in length dictionary places a familiar ant at about 5 mm.","#2b9890"],
    ["02-estimate","estimate","02 / QUESTION AN ESTIMATE","Could an ant really be five metres long?","A deliberately implausible estimate is compared with a car and a bus.","#e89129"],
    ["03-revised","revised","03 / CHANGE THE UNIT","A tiny unit change. A thousandfold difference.","Revise 5 m to 5 mm and inspect the new reference objects.","#9270d8"],
    ["04-capacity","capacity","04 / EXPLORE ANOTHER QUANTITY","How much is one litre?","Use familiar containers to talk about capacity, then check a real object.","#2b9890"],
  ];
  for (const [file, raw, kicker, title, description, accent] of cards) {
    await render(output + "/" + file + ".png", 1440, 1110, `
      <div style="padding:35px 48px 0"><div class="eyebrow" style="color:${accent}">${kicker}</div>
      <h1 style="font-size:39px;letter-spacing:-1px;margin:12px 0 8px">${title}</h1>
      <p class="muted" style="font-size:20px;margin:0">${description}</p></div>
      <img src="${dataImage(work + "/" + raw + ".png")}" style="position:absolute;left:32px;top:184px;width:1376px;height:860px;border:1px solid #e1d5bf;border-radius:18px;box-shadow:0 12px 25px #352b1c15">
      <div style="position:absolute;bottom:23px;left:48px;font-size:17px;color:#776c60">Actual local interface · English annotations · Chinese activity text</div>
      <div style="position:absolute;bottom:23px;right:48px;font-size:17px;font-weight:700">CHIBOSHI / MEASUREMENT PLAYGROUND</div>
    `);
  }
  const frames = [
    ["01-home","MEASUREMENT PLAYGROUND","What does a measurement look like?","Connect numbers with familiar objects.","English entry page","Choose a learning activity."],
    ["02-reference","01 / FIND A REFERENCE","Start with something familiar.","The length dictionary shows an ant at about 5 mm.","Built-in reference library","Approximate examples are starting points for discussion."],
    ["03-compare","02 / ESTIMATE & REVISE","Could an ant be five metres long?","Compare 5 m, then change the input to 5 mm.","Real local comparison","5 m = 5,000 mm. Changing to 5 mm makes the length 1,000× smaller."],
    ["04-capacity","03 / KEEP EXPLORING","How much is one litre?","Use everyday containers to discuss capacity.","Six measurement dimensions","Length · Mass · Capacity · Area · Volume · Time"],
  ];
  for (const [id,kicker,title,description,badge,caption] of frames) {
    await render(work + "/frame-" + id + ".png", 1600, 900, `
      <div style="position:absolute;left:42px;top:32px;font-size:21px;font-weight:750">CHIBOSHI <span style="font-weight:400;color:#887967">/ Measurement Playground</span></div>
      <div style="position:absolute;right:42px;top:38px;font-size:16px;color:#887967">REAL LOCAL WALKTHROUGH · ENGLISH ANNOTATIONS</div>
      <div style="position:absolute;left:42px;top:151px;width:365px">
        <div class="eyebrow" style="font-size:15px;letter-spacing:2px;color:#288f88">${kicker}</div>
        <h1 style="font-size:46px;line-height:1.08;letter-spacing:-1.5px;margin:23px 0">${title}</h1>
        <p style="font-size:23px;line-height:1.5;color:#796b5b">${description}</p>
        <div style="margin-top:30px;height:4px;width:64px;background:#eeab44"></div>
      </div>
      <div style="position:absolute;left:440px;top:85px;width:1118px;height:734px;border:1px solid #ddcfb2;background:white;border-radius:17px;box-shadow:0 13px 25px #34271c16">
        <div style="height:39px;padding:10px 17px;color:#776c60;font-size:14px">● ● ● <span style="margin-left:20px">${badge}</span></div>
      </div>
      <div style="position:absolute;left:42px;top:694px;width:350px;font-size:16px;line-height:1.6;color:#8b7966">Chinese classroom interface<br>No API key used in this recording<br>Local fallback shown for comparison</div>
      <div style="position:absolute;left:440px;top:841px;width:1115px;font-size:19px;font-weight:600">${caption}</div>
      <div style="position:absolute;bottom:27px;left:42px;font-size:16px;color:#796b5b">github.com/734496335/chiboshi-edu</div>
    `);
  }
  await render(work + "/outro.png", 1600, 900, `
    <div style="position:absolute;inset:35px;border:1px solid #decfae;border-radius:24px"></div>
    <div style="position:absolute;left:90px;top:102px;width:1040px">
      <div class="eyebrow" style="color:#258c86">OPEN EDUCATION · INDEPENDENTLY MAINTAINED</div>
      <h1 style="font-size:79px;letter-spacing:-3px;line-height:1.08;margin:32px 0">Explore. Explain.<br><span style="color:#e89129">Contribute.</span></h1>
      <p style="font-size:29px;margin:25px 0">Make the next lesson better.</p>
      <div class="mono" style="margin:36px 0;padding:25px 30px;border-radius:16px;background:#3e3128;color:#fff8e8;font-size:29px;line-height:1.65;width:680px">$ npm ci<br>$ npm run dev</div>
      <p style="font-size:21px;color:#796b5b">Improve examples · Translate activities · Strengthen accessibility</p>
      <p class="mono" style="font-size:27px;margin:36px 0 20px">github.com/734496335/chiboshi-edu</p>
      <p style="font-size:21px;color:#258c86">MIT-licensed source · English guides · Chinese activities</p>
    </div>
    <img src="${owl}" style="position:absolute;right:45px;top:250px;width:430px;height:480px">
  `);
  await render(work + "/gif-frame.png", 960, 720, `
    <div style="position:absolute;left:30px;top:19px;color:#258c86;font-size:14px;font-weight:750;letter-spacing:2px">CHIBOSHI · ESTIMATE / COMPARE / REVISE</div>
    <h1 style="position:absolute;left:30px;top:35px;font-size:34px;letter-spacing:-1px">5 m → 5 mm. What changes?</h1>
    <div style="position:absolute;left:30px;top:114px;width:900px;height:563px;border:1px solid #e1d5bf;border-radius:12px;background:white"></div>
    <div style="position:absolute;left:30px;bottom:15px;font-size:15px;color:#776c60">Actual Chinese interface · No API key · Watch the full English walkthrough below</div>
  `);
  await render(output + "/video-poster.png", 1600, 900, `
    <img src="${dataImage(work + "/frame-03-compare.png")}" style="position:absolute;inset:0;width:1600px;height:900px">
    <img src="${dataImage(work + "/estimate.png")}" style="position:absolute;left:455px;top:124px;width:1088px;height:680px">
    <div style="position:absolute;left:941px;top:402px;width:112px;height:112px;border-radius:56px;background:#3e3128e8;border:4px solid white;color:white;font-size:55px;text-align:center;padding:12px 0 0 8px">▶</div>
  `);
  await composer.close();
  fs.writeFileSync(work + "/capture.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({sourceCommit:manifest.sourceCommit,scenes:manifest.scenes,comparisons:manifest.comparisons,pageErrors:manifest.pageErrors}));
} finally { await browser.close(); }
