import * as fs from "node:fs";
import * as path from "node:path";

/**
 * LLM API 客户端（OpenAI 兼容协议）
 *
 * 仅在服务端使用——API key 永远不能暴露给浏览器。
 *
 * 支持任何兼容 OpenAI /chat/completions 协议的国产大模型，目前用于：
 * - 小米 MiMo (mimo-v2.5-pro)，base url: https://token-plan-cn.xiaomimimo.com/v1
 * - DeepSeek (deepseek-chat)，base url: https://api.deepseek.com
 *
 * 环境变量（按优先级回退）：
 * - LLM_API_KEY     ← 推荐通用名
 * - LLM_BASE_URL
 * - LLM_MODEL
 *   或
 * - DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL  (向后兼容)
 *
 * 默认 base url 是 MiMo（既然已经申请了 key）。
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  /** 控制随机性，0 = 完全确定，1 = 创意高。默认 0.7 */
  temperature?: number;
  /** 返回 JSON 对象（DeepSeek 兼容 OpenAI 的 response_format） */
  jsonMode?: boolean;
  /** 超时毫秒，默认 15s */
  timeoutMs?: number;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

/**
 * 调用 DeepSeek chat completion
 * @returns 返回纯文本内容（如果 jsonMode 则是 JSON 字符串，调用方负责 parse）
 */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  // Load config from local llm_config.json if exists
  let localConfig: { apiKey?: string; baseUrl?: string; model?: string } = {};
  try {
    const configPath = path.join(process.cwd(), "llm_config.json");
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf-8");
      localConfig = JSON.parse(data);
    }
  } catch {
    // ignore
  }

  const apiKey = localConfig.apiKey || process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      "缺少环境变量或 LLM_API_KEY 配置。请点击页面底部设置图标配置或在 .env.local 中填入。",
    );
  }
  const baseUrl =
    localConfig.baseUrl ||
    process.env.LLM_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    "https://token-plan-cn.xiaomimimo.com/v1";
  const model =
    localConfig.model ||
    process.env.LLM_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    "mimo-v2.5-pro";

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.jsonMode
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new DeepSeekError(
        `DeepSeek 请求失败 (HTTP ${res.status})`,
        res.status,
        detail,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new DeepSeekError("DeepSeek 返回内容为空");
    }
    return content;
  } catch (err) {
    if (err instanceof DeepSeekError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new DeepSeekError("DeepSeek 请求超时");
    }
    throw new DeepSeekError(
      `DeepSeek 调用异常: ${(err as Error).message}`,
      undefined,
      err,
    );
  } finally {
    clearTimeout(t);
  }
}

/**
 * JSON 模式专用 helper：直接解析并 typed 返回
 * @throws DeepSeekError 如果返回不是合法 JSON
 */
export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  opts: Omit<ChatOptions, "jsonMode"> = {},
): Promise<T> {
  const raw = await chat(messages, { ...opts, jsonMode: true });
  // 1) 直接 parse
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 2) 兜底：尝试剥 markdown 代码块  ```json ... ```
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        /* ignore */
      }
    }
    // 3) 兜底：抓出第一个 {...} 块
    const braced = raw.match(/\{[\s\S]*\}/);
    if (braced) {
      try {
        return JSON.parse(braced[0]) as T;
      } catch {
        /* ignore */
      }
    }
    throw new DeepSeekError(
      `LLM 返回不是合法 JSON: ${raw.slice(0, 200)}`,
    );
  }
}
