import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.join(process.cwd(), "llm_config.json");
const KEEP_EXISTING = "____KEEP_EXISTING____";
const NO_STORE = { "Cache-Control": "no-store" };

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function readEffectiveConfig(): Promise<LlmConfig> {
  let local: Partial<LlmConfig> = {};
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = parsed as Record<string, unknown>;
      local = {
        apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
        baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "",
        model: typeof value.model === "string" ? value.model : "",
      };
    }
  } catch {
    // Match the shared provider client's fallback when local settings are absent.
  }
  return {
    apiKey: local.apiKey || process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || "",
    baseUrl: local.baseUrl || process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1",
    model: local.model || process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || "mimo-v2.5-pro",
  };
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid provider base URL");
  }
  return url.toString().replace(/\/+$/, "");
}

export async function GET() {
  try {
    const config = await readEffectiveConfig();
    // Explicit allowlist: the key itself must never be serialized to the browser.
    return NextResponse.json({
      success: true,
      config: {
        baseUrl: normalizeBaseUrl(config.baseUrl),
        model: config.model,
        hasKey: Boolean(config.apiKey),
        maskedKey: config.apiKey ? "********" : "",
      },
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to read local model settings." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(req: Request) {
  // This is a browser-origin check, not multi-user authentication. The supplied
  // application commands bind to loopback; public hosting is unsupported.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json(
      { success: false, error: "Cross-origin settings changes are not allowed." },
      { status: 403, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected a JSON object." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Expected a JSON object." },
      { status: 400, headers: NO_STORE },
    );
  }
  const fields = body as Record<string, unknown>;
  for (const field of ["apiKey", "baseUrl", "model"]) {
    if (field in fields && typeof fields[field] !== "string") {
      return NextResponse.json(
        { success: false, error: `${field} must be a string.` },
        { status: 400, headers: NO_STORE },
      );
    }
  }

  try {
    const existing = await readEffectiveConfig();
    let baseUrl: string;
    try {
      baseUrl = normalizeBaseUrl((fields.baseUrl as string | undefined)?.trim() || existing.baseUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: "Use an HTTP(S) base URL without credentials, query parameters, or a fragment." },
        { status: 400, headers: NO_STORE },
      );
    }
    const suppliedKey = (fields.apiKey as string | undefined)?.trim() || "";
    const keepKey = !suppliedKey || suppliedKey === KEEP_EXISTING;
    let currentBaseUrl: string | null = null;
    try {
      currentBaseUrl = normalizeBaseUrl(existing.baseUrl);
    } catch {
      // A valid new provider and new key may repair an invalid legacy setting.
    }
    if (keepKey && existing.apiKey && baseUrl !== currentBaseUrl) {
      return NextResponse.json(
        { success: false, error: "Enter the new provider's API key when changing its base URL." },
        { status: 400, headers: NO_STORE },
      );
    }
    const config: LlmConfig = {
      apiKey: keepKey ? existing.apiKey : suppliedKey,
      baseUrl,
      model: (fields.model as string | undefined)?.trim() || existing.model,
    };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 0o600 });
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to save local model settings." },
      { status: 500, headers: NO_STORE },
    );
  }
}
