/**
 * AI 像素画测试页 —— 输入物体名 → 调用 /api/ai/pixel → 多尺寸预览
 *
 * 路径：/dev/pixel-test
 */
"use client";

import * as React from "react";

interface GenResponse {
  id?: string;
  url?: string;
  slug?: string;
  svg?: string;
  cached?: boolean;
  attempts?: number;
  error?: string;
  reason?: string;
  raw?: string[];
}

const PRESETS = [
  "椰子树",
  "蚂蚁",
  "海口骑楼",
  "五指山",
  "小汽车",
  "校车",
  "灯塔",
  "塔吊",
  "迪拜哈利法塔",
  "篮球",
  "西瓜",
  "邮票",
  "矿泉水瓶",
  "电饭煲",
  "大象",
  "蓝鲸",
];

export default function PixelTestPage() {
  const [object, setObject] = React.useState("椰子树");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<GenResponse | null>(null);
  const [history, setHistory] = React.useState<GenResponse[]>([]);

  async function generate(force: boolean) {
    if (!object.trim()) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/ai/pixel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ object: object.trim(), force }),
      });
      const json = (await res.json()) as GenResponse;
      json.svg = json.svg || (json.url ? await fetch(json.url).then((r) => r.text()) : undefined);
      setData(json);
      setHistory((h) => [{ ...json }, ...h].slice(0, 12));
    } catch (e) {
      setData({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">AI 像素画测试</h1>
        <p className="text-sm text-stone-600 mb-4">
          调用 <code>/api/ai/pixel</code>，让 MiMo 直接输出 16×16 像素画 SVG，
          缓存到 <code>public/icons/pixel/{"{slug}"}.svg</code>。
          <br />
          如果效果不好，把"重新生成"打开（绕过缓存），或调
          <code> src/app/api/ai/pixel/route.ts </code>里的
          <code> SYS_PROMPT </code>。
        </p>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2 mb-3">
            <input
              value={object}
              onChange={(e) => setObject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate(false)}
              className="flex-1 border border-stone-300 rounded px-3 py-2"
              placeholder="输入物体名，例如：椰子树"
              disabled={loading}
            />
            <button
              onClick={() => generate(false)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {loading ? "生成中…" : "生成"}
            </button>
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded disabled:opacity-50"
              title="跳过缓存重新生成"
            >
              重新生成
            </button>
          </div>
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="text-stone-500 mr-1">快捷：</span>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setObject(p)}
                className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            {data.error ? (
              <div className="text-red-600">
                <div className="font-semibold mb-1">{data.error}</div>
                {data.reason && (
                  <div className="text-sm text-stone-600">{data.reason}</div>
                )}
                {data.raw && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">查看 MiMo 原始返回（{data.raw.length} 次）</summary>
                    {data.raw.map((r, i) => (
                      <pre
                        key={i}
                        className="bg-stone-100 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap"
                      >
                        {r.slice(0, 800)}
                      </pre>
                    ))}
                  </details>
                )}
              </div>
            ) : (
              <ResultView data={data} />
            )}
          </div>
        )}

        {history.length > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">历史（最近 12 次）</h3>
            <div className="grid grid-cols-6 gap-3">
              {history.map((h, i) => (
                <div key={i} className="text-center">
                  <div
                    className="w-full aspect-square mb-1 mx-auto"
                    style={{
                      background:
                        "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 8px 8px",
                    }}
                    dangerouslySetInnerHTML={
                      h.svg
                        ? {
                            __html: h.svg.replace(
                              "<svg ",
                              '<svg style="width:100%;height:100%;image-rendering:pixelated" ',
                            ),
                          }
                        : undefined
                    }
                  />
                  <div
                    className="text-xs truncate"
                    title={h.slug}
                  >
                    {h.slug}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({ data }: { data: GenResponse }) {
  const sizes = [16, 32, 64, 128, 256];
  return (
    <>
      <div className="flex items-center justify-between text-sm text-stone-600 mb-3">
        <div>
          <span className="font-mono">{data.id}</span>
          {data.cached ? (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
              cached
            </span>
          ) : (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              生成成功（第 {data.attempts} 次尝试）
            </span>
          )}
        </div>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener"
            className="text-blue-600 hover:underline text-xs"
          >
            打开 SVG 文件 →
          </a>
        )}
      </div>

      <div className="flex items-end gap-4 mb-4 flex-wrap">
        {sizes.map((s) => (
          <div key={s} className="text-center">
            <div
              style={{
                width: s,
                height: s,
                background:
                  "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 8px 8px",
              }}
              dangerouslySetInnerHTML={
                data.svg
                  ? {
                      __html: data.svg.replace(
                        "<svg ",
                        `<svg style="width:${s}px;height:${s}px;image-rendering:pixelated" `,
                      ),
                    }
                  : undefined
              }
            />
            <div className="text-xs text-stone-500 mt-1">{s}px</div>
          </div>
        ))}
      </div>

      {data.svg && (
        <details className="text-xs">
          <summary className="cursor-pointer text-stone-600">查看 SVG 源码</summary>
          <pre className="bg-stone-100 p-2 rounded mt-1 overflow-x-auto">
            {data.svg}
          </pre>
        </details>
      )}
    </>
  );
}
