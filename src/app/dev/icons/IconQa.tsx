"use client";

import * as React from "react";

export interface IconItem {
  id: string;
  label: string;
  category: string;
  prompt?: string;
  url: string; // initial url, may be cache-busted after regen
}

interface Group {
  category: string;
  items: IconItem[];
}

interface CardState {
  url: string;
  prompt: string;
  status: "idle" | "running" | "ok" | "error";
  error?: string;
  log?: string;
  elapsedMs?: number;
  expanded: boolean;
}

const FLAG_STORAGE_KEY = "dev-icons-flagged-v1";

function loadFlagged(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FLAG_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveFlagged(s: Set<string>) {
  try {
    window.localStorage.setItem(
      FLAG_STORAGE_KEY,
      JSON.stringify(Array.from(s)),
    );
  } catch {
    /* ignore */
  }
}

interface BakerSnapshot {
  status:
    | "idle"
    | "starting"
    | "loading-base"
    | "loading-lora"
    | "loading-gpu"
    | "ready"
    | "busy"
    | "dead";
  queueLen: number;
  pendingId: string | null;
  startedAt: number | null;
  readyAt: number | null;
  lastEvent: string | null;
  fatalError: string | null;
}

const BAKER_STATUS_LABEL: Record<BakerSnapshot["status"], string> = {
  idle: "待启动",
  starting: "启动中",
  "loading-base": "加载 SDXL 基模…",
  "loading-lora": "加载 pixel-art LoRA…",
  "loading-gpu": "推到 GPU + warmup…",
  ready: "就绪",
  busy: "烘焙中",
  dead: "已退出",
};

const BAKER_STATUS_COLOR: Record<BakerSnapshot["status"], string> = {
  idle: "bg-stone-300",
  starting: "bg-amber-400",
  "loading-base": "bg-amber-400",
  "loading-lora": "bg-amber-400",
  "loading-gpu": "bg-amber-400",
  ready: "bg-emerald-500",
  busy: "bg-sky-500",
  dead: "bg-rose-500",
};

function BakerStatusBar() {
  const [snap, setSnap] = React.useState<BakerSnapshot | null>(null);
  const [warming, setWarming] = React.useState(false);

  const fetchSnap = React.useCallback(async () => {
    try {
      const r = await fetch("/api/dev/baker/warmup", { method: "GET" });
      const j = (await r.json()) as Partial<BakerSnapshot> & { ok?: boolean };
      if (j && typeof j.status === "string") setSnap(j as BakerSnapshot);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    fetchSnap();
    const t = setInterval(fetchSnap, 2000);
    return () => clearInterval(t);
  }, [fetchSnap]);

  const triggerWarmup = React.useCallback(async () => {
    setWarming(true);
    try {
      await fetch("/api/dev/baker/warmup", { method: "GET" });
      await fetchSnap();
    } finally {
      setWarming(false);
    }
  }, [fetchSnap]);

  if (!snap) {
    return (
      <div className="text-xs text-stone-500">正在查询本地烘焙器状态…</div>
    );
  }
  const label = BAKER_STATUS_LABEL[snap.status];
  const dotCls = BAKER_STATUS_COLOR[snap.status];
  const elapsed =
    snap.startedAt && !snap.readyAt
      ? `${Math.round((Date.now() - snap.startedAt) / 1000)}s`
      : null;
  const readyTime =
    snap.startedAt && snap.readyAt
      ? `${((snap.readyAt - snap.startedAt) / 1000).toFixed(1)}s`
      : null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span
        className={`inline-block w-2 h-2 rounded-full ${dotCls} ${
          snap.status === "busy" ||
          snap.status === "starting" ||
          snap.status.startsWith("loading")
            ? "animate-pulse"
            : ""
        }`}
      />
      <span className="font-medium">本地烘焙器：{label}</span>
      {snap.status === "busy" && snap.pendingId && (
        <span className="text-stone-500">正在烘 {snap.pendingId}</span>
      )}
      {snap.queueLen > 0 && (
        <span className="text-stone-500">队列 {snap.queueLen}</span>
      )}
      {elapsed && <span className="text-stone-500">已加载 {elapsed}</span>}
      {readyTime && (
        <span className="text-stone-500">启动用时 {readyTime}</span>
      )}
      {snap.fatalError && (
        <span className="text-rose-600 truncate" title={snap.fatalError}>
          错误：{snap.fatalError}
        </span>
      )}
      {(snap.status === "idle" || snap.status === "dead") && (
        <button
          type="button"
          onClick={triggerWarmup}
          disabled={warming}
          className="px-2 py-0.5 rounded border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40"
        >
          {warming ? "启动中…" : "启动烘焙器"}
        </button>
      )}
    </div>
  );
}

interface CreateState {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
  url?: string;
  elapsedMs?: number;
}

function CreateItemForm({ categories }: { categories: string[] }) {
  const [label, setLabel] = React.useState("");
  const [id, setId] = React.useState("");
  const [category, setCategory] = React.useState(categories[0] ?? "");
  const [newCategory, setNewCategory] = React.useState("");
  const [axis, setAxis] = React.useState<
    "horizontal" | "vertical" | "either" | "square"
  >("either");
  const [aliases, setAliases] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [state, setState] = React.useState<CreateState>({ status: "idle" });

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (state.status === "running") return;
      const finalCategory = (newCategory.trim() || category).trim();
      if (!label.trim()) {
        setState({ status: "error", message: "请填中文物品名" });
        return;
      }
      if (!finalCategory) {
        setState({ status: "error", message: "请选择或输入分类" });
        return;
      }
      setState({ status: "running" });
      try {
        const res = await fetch("/api/dev/icons/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: id.trim() || undefined,
            label: label.trim(),
            category: finalCategory,
            axis,
            aliases: aliases.trim() || undefined,
            prompt: prompt.trim() || undefined,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          id?: string;
          url?: string;
          error?: string;
          elapsedMs?: number;
        };
        if (!res.ok || !data.ok) {
          setState({
            status: "error",
            message: data.error ?? `HTTP ${res.status}`,
          });
          return;
        }
        setState({
          status: "ok",
          message: `已生成 ${data.id}`,
          url: data.url,
          elapsedMs: data.elapsedMs,
        });
        // 成功后清空一些字段，但保留 category/axis 方便连续录入
        setLabel("");
        setId("");
        setAliases("");
        setPrompt("");
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      label,
      id,
      category,
      newCategory,
      axis,
      aliases,
      prompt,
      state.status,
    ],
  );

  const running = state.status === "running";

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-stone-200 rounded-lg p-4 mb-6"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">无限新建物品</h2>
          <p className="text-xs text-stone-500">
            填写后点"生成"即把条目写入 catalog 并烘 PNG，沙盒模式可立即使用此参考物。
          </p>
        </div>
        <BakerStatusBar />
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-stone-600">
            物品中文名 <span className="text-rose-500">*</span>
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：充电宝"
            disabled={running}
            className="px-2 py-1.5 border border-stone-300 rounded text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-stone-600">
            ID（slug，留空自动）
          </span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="power_bank"
            spellCheck={false}
            disabled={running}
            className="px-2 py-1.5 border border-stone-300 rounded text-sm font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-stone-600">
            分类 <span className="text-rose-500">*</span>
          </span>
          <div className="flex gap-1">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={running || !!newCategory.trim()}
              className="px-2 py-1.5 border border-stone-300 rounded text-sm flex-1"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="或输入新分类"
              disabled={running}
              className="px-2 py-1.5 border border-stone-300 rounded text-sm w-32"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-stone-600">轴向（用于长度对比挑选）</span>
          <select
            value={axis}
            onChange={(e) =>
              setAxis(
                e.target.value as
                  | "horizontal"
                  | "vertical"
                  | "either"
                  | "square",
              )
            }
            disabled={running}
            className="px-2 py-1.5 border border-stone-300 rounded text-sm"
          >
            <option value="either">either（不限）</option>
            <option value="horizontal">horizontal（横向延伸）</option>
            <option value="vertical">vertical（竖向延伸）</option>
            <option value="square">square（方/无明显方向）</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="text-stone-600">
            别名（逗号分隔，可选——AI 解析时模糊匹配用）
          </span>
          <input
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="移动电源, 移动电池"
            disabled={running}
            className="px-2 py-1.5 border border-stone-300 rounded text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-3">
          <span className="text-stone-600">
            英文 prompt 主体（可选；留空则用 label 兜底；末尾自动追加风格后缀）
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="例如：rectangular black power bank with USB ports, side view"
            disabled={running}
            className="px-2 py-1.5 border border-stone-300 rounded text-sm font-mono"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={running}
          className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-40"
        >
          {running ? "生成中…（首次会等模型加载）" : "生成新物品"}
        </button>
        {state.status === "ok" && (
          <span className="text-xs text-emerald-700 flex items-center gap-2">
            ✓ {state.message}
            {state.elapsedMs !== undefined &&
              ` · ${(state.elapsedMs / 1000).toFixed(1)}s`}
            {state.url && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.url}
                  alt="preview"
                  style={{
                    width: 32,
                    height: 32,
                    imageRendering: "pixelated",
                  }}
                  className="bg-stone-100 border border-stone-200 rounded"
                />
                <a
                  href={state.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  查看
                </a>
                <span className="text-stone-500">
                  （刷新页面后会出现在下方分组中）
                </span>
              </>
            )}
          </span>
        )}
        {state.status === "error" && (
          <span className="text-xs text-rose-600 break-all">
            ✗ {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function IconQa({
  groups,
  categories,
}: {
  groups: Group[];
  categories: string[];
}) {
  const allItems = React.useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  const [flagged, setFlagged] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    setFlagged(loadFlagged());
  }, []);

  const toggleFlag = React.useCallback((id: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFlagged(next);
      return next;
    });
  }, []);

  const clearFlags = React.useCallback(() => {
    setFlagged(new Set());
    saveFlagged(new Set());
  }, []);

  // 每张图独立状态
  const [cards, setCards] = React.useState<Record<string, CardState>>(() => {
    const init: Record<string, CardState> = {};
    for (const it of allItems) {
      init[it.id] = {
        url: it.url,
        prompt: it.prompt ?? "",
        status: "idle",
        expanded: false,
      };
    }
    return init;
  });

  const patchCard = React.useCallback(
    (id: string, patch: Partial<CardState>) =>
      setCards((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    [],
  );

  const [batchRunning, setBatchRunning] = React.useState(false);
  const [batchInfo, setBatchInfo] = React.useState<string>("");

  const regenerate = React.useCallback(
    async (id: string, prompt: string) => {
      patchCard(id, {
        status: "running",
        error: undefined,
        log: undefined,
        elapsedMs: undefined,
      });
      try {
        const res = await fetch("/api/dev/icons/regenerate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, prompt: prompt || undefined }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          url?: string;
          elapsedMs?: number;
          error?: string;
          log?: string;
          logTail?: string;
        };
        if (!res.ok || !data.ok) {
          patchCard(id, {
            status: "error",
            error: data.error ?? `HTTP ${res.status}`,
            log: data.log ?? data.logTail,
            elapsedMs: data.elapsedMs,
          });
          return false;
        }
        patchCard(id, {
          status: "ok",
          url: data.url ?? `/icons/pixel/${id}.png?t=${Date.now()}`,
          elapsedMs: data.elapsedMs,
          log: data.logTail,
        });
        return true;
      } catch (e) {
        patchCard(id, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
        return false;
      }
    },
    [patchCard],
  );

  const regenAllFlagged = React.useCallback(async () => {
    const ids = Array.from(flagged);
    if (ids.length === 0) return;
    setBatchRunning(true);
    let done = 0;
    let failed = 0;
    for (const id of ids) {
      setBatchInfo(
        `进度 ${done + failed + 1}/${ids.length} · 正在 ${id} · 已成功 ${done} · 失败 ${failed}`,
      );
      const promptVal = cards[id]?.prompt ?? "";
      const ok = await regenerate(id, promptVal);
      if (ok) done += 1;
      else failed += 1;
    }
    setBatchInfo(`完成：成功 ${done} · 失败 ${failed} / ${ids.length}`);
    setBatchRunning(false);
  }, [flagged, cards, regenerate]);

  const flaggedCount = flagged.size;

  return (
    <>
      <CreateItemForm categories={categories} />
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 mb-6 bg-stone-50/95 backdrop-blur border-b border-stone-200 flex items-center gap-3 flex-wrap">
        <span className="text-sm">
          已标记 <strong className="text-rose-600">{flaggedCount}</strong> 项
        </span>
        <button
          type="button"
          disabled={flaggedCount === 0 || batchRunning}
          onClick={regenAllFlagged}
          className="px-3 py-1.5 text-sm rounded bg-rose-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-700"
        >
          {batchRunning ? "重新生成中…" : "重新生成所有勾选"}
        </button>
        <button
          type="button"
          disabled={flaggedCount === 0 || batchRunning}
          onClick={clearFlags}
          className="px-3 py-1.5 text-sm rounded border border-stone-300 bg-white disabled:opacity-40"
        >
          清空标记
        </button>
        {batchInfo && (
          <span className="text-xs text-stone-600">{batchInfo}</span>
        )}
        <span className="ml-auto text-xs text-stone-500">
          单次重生 ≈ 20–40 秒（首次加载模型更慢）。串行执行。
        </span>
      </div>

      {groups.map((g) => (
        <section key={g.category} className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            {g.category}{" "}
            <span className="text-sm text-stone-500 font-normal">
              ({g.items.length})
            </span>
          </h2>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            {g.items.map((it) => {
              const st = cards[it.id];
              const isFlagged = flagged.has(it.id);
              return (
                <div
                  key={it.id}
                  className={`bg-white rounded border p-2 flex flex-col text-center transition ${
                    isFlagged
                      ? "border-rose-400 ring-2 ring-rose-200"
                      : "border-stone-200"
                  }`}
                >
                  <label className="flex items-center gap-1 text-[11px] text-stone-600 self-start cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFlagged}
                      onChange={() => toggleFlag(it.id)}
                      disabled={batchRunning}
                    />
                    有问题
                  </label>
                  <div
                    className="w-full aspect-square my-1 flex items-center justify-center relative"
                    style={{
                      background:
                        "repeating-conic-gradient(#f1f1f1 0% 25%, #fff 0% 50%) 50% / 10px 10px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={st?.url ?? it.url}
                      alt={it.label}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        imageRendering: "pixelated",
                        display: "block",
                      }}
                    />
                    {st?.status === "running" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium">
                        生成中…
                      </div>
                    )}
                    {st?.status === "ok" && (
                      <div className="absolute top-1 right-1 text-[10px] px-1 rounded bg-emerald-600 text-white">
                        新
                      </div>
                    )}
                    {st?.status === "error" && (
                      <div className="absolute top-1 right-1 text-[10px] px-1 rounded bg-rose-600 text-white">
                        失败
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium leading-tight truncate" title={it.label}>
                    {it.label}
                  </div>
                  <div
                    className="text-[10px] font-mono text-stone-500 leading-tight truncate w-full"
                    title={it.id}
                  >
                    {it.id}
                  </div>

                  <button
                    type="button"
                    onClick={() => patchCard(it.id, { expanded: !st?.expanded })}
                    className="mt-1 text-[11px] text-stone-600 hover:text-stone-900"
                  >
                    {st?.expanded ? "▲ 收起提示词" : "▼ 编辑提示词"}
                  </button>

                  {st?.expanded && (
                    <div className="mt-1 flex flex-col gap-1">
                      <textarea
                        value={st.prompt}
                        onChange={(e) =>
                          patchCard(it.id, { prompt: e.target.value })
                        }
                        rows={4}
                        spellCheck={false}
                        className="text-[11px] font-mono p-1 border border-stone-300 rounded resize-y w-full bg-stone-50"
                        placeholder={`(留空则沿用 prompts.py 内置 / label 兜底)`}
                        disabled={st.status === "running" || batchRunning}
                      />
                      <button
                        type="button"
                        onClick={() => regenerate(it.id, st.prompt)}
                        disabled={st.status === "running" || batchRunning}
                        className="text-xs px-2 py-1 rounded bg-stone-800 text-white disabled:opacity-40 hover:bg-stone-700"
                      >
                        {st.status === "running" ? "生成中…" : "重新生成"}
                      </button>
                      {st.elapsedMs !== undefined && (
                        <div className="text-[10px] text-stone-500">
                          耗时 {(st.elapsedMs / 1000).toFixed(1)}s
                        </div>
                      )}
                      {st.error && (
                        <div className="text-[10px] text-rose-600 break-all">
                          {st.error}
                        </div>
                      )}
                      {st.log && (
                        <details className="text-[10px] text-stone-500">
                          <summary className="cursor-pointer">日志</summary>
                          <pre className="whitespace-pre-wrap text-[10px] max-h-40 overflow-auto bg-stone-100 p-1">
                            {st.log}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
