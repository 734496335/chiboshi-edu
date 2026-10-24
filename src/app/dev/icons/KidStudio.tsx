"use client";

/**
 * 造物小工坊 —— 面向儿童的"图标生成"页面（替代 IconQa 的开发态界面）
 *
 * 设计准则（与 DictionaryStage / 首页保持一致）：
 *   1. 米黄底 + 圆角大卡 + font-display + 紫色调（与首页第三张卡呼应）
 *   2. 只暴露孩子能懂的字段：物品名 + 分类（用 emoji chip 而不是下拉）
 *   3. 创造态有"尺博士正在画…"的拟人化等待提示，不暴露技术细节
 *   4. 成功后大图揭幕 + 一句鼓励语
 *   5. 画廊只展示，不允许标记 / 编辑 / 重生（那些留给 /dev 的 IconQa）
 *
 * 数据来自 page.tsx 服务端：groups（已生成的物品按分类分组）+ categories。
 * 复用既有 API：POST /api/dev/icons/create（kid 只传 label/category）。
 */

import * as React from "react";
import Link from "next/link";
import { resolveAsset } from "@/lib/utils";
import type { IconItem } from "./IconQa";

interface Group {
  category: string;
  items: IconItem[];
}

// 给"分类"添加一个孩子能 get 的 emoji。未列入的分类回落到 ✨。
// 顺序也是 chip 在表单里展示的优先顺序——尽量把孩子常想造的放前面。
const CATEGORY_EMOJI: Array<{ key: string; emoji: string; alias?: string }> = [
  { key: "fruit", emoji: "🍎", alias: "水果" },
  { key: "vegetable", emoji: "🥕", alias: "蔬菜" },
  { key: "food", emoji: "🍱", alias: "食物" },
  { key: "snack", emoji: "🍪", alias: "零食" },
  { key: "toy", emoji: "🧸", alias: "玩具" },
  { key: "stationery", emoji: "✏️", alias: "文具" },
  { key: "animal", emoji: "🐱", alias: "动物" },
  { key: "vehicle", emoji: "🚗", alias: "交通工具" },
  { key: "clothes", emoji: "👕", alias: "衣物" },
  { key: "instrument", emoji: "🎵", alias: "乐器" },
  { key: "sport", emoji: "⚽", alias: "运动" },
  { key: "tool", emoji: "🔧", alias: "工具" },
  { key: "appliance", emoji: "🔌", alias: "电器" },
  { key: "kitchenware", emoji: "🍳", alias: "厨房用品" },
  { key: "furniture", emoji: "🪑", alias: "家具" },
  { key: "building", emoji: "🏢", alias: "建筑" },
  { key: "nature", emoji: "🌳", alias: "自然" },
  { key: "weapon", emoji: "⚔️", alias: "武器" },
  // 以下分类来自 visual-assets.json 的英文 key，给孩子看也要中文显示。
  // 顺序仅在 chip picker 里用到；这里按"生活近 → 科学远"的直觉粗排。
  { key: "plant", emoji: "🌿", alias: "植物" },
  { key: "flower", emoji: "🌸", alias: "花卉" },
  { key: "fruit", emoji: "🍎", alias: "水果" },
  { key: "vegetable", emoji: "🥕", alias: "蔬菜" },
  { key: "kitchen", emoji: "🍳", alias: "厨房" },
  { key: "container", emoji: "🥡", alias: "容器" },
  { key: "hygiene", emoji: "🧼", alias: "卫生" },
  { key: "cosmetics", emoji: "💄", alias: "化妆品" },
  { key: "clothing", emoji: "👕", alias: "服饰" },
  { key: "jewelry", emoji: "💍", alias: "首饰" },
  { key: "body", emoji: "🧒", alias: "人体" },
  { key: "human", emoji: "👤", alias: "人物" },
  { key: "pet", emoji: "🐶", alias: "宠物" },
  { key: "mammal", emoji: "🐘", alias: "哺乳动物" },
  { key: "bird", emoji: "🐦", alias: "鸟类" },
  { key: "fish", emoji: "🐟", alias: "鱼类" },
  { key: "reptile", emoji: "🦎", alias: "爬行动物" },
  { key: "insect", emoji: "🐛", alias: "昆虫" },
  { key: "microorganism", emoji: "🦠", alias: "微生物" },
  { key: "electronics", emoji: "📱", alias: "电子设备" },
  { key: "music", emoji: "🎵", alias: "音乐" },
  { key: "sports", emoji: "🏀", alias: "运动" },
  { key: "medical", emoji: "💊", alias: "医疗" },
  { key: "science", emoji: "🔬", alias: "科学" },
  { key: "festival", emoji: "🎉", alias: "节日" },
  { key: "history", emoji: "📜", alias: "历史" },
  { key: "geography", emoji: "🗺️", alias: "地理" },
  { key: "flag", emoji: "🏳️", alias: "旗帜" },
  { key: "sign", emoji: "🪧", alias: "标志" },
  { key: "award", emoji: "🏆", alias: "奖项" },
  // 量感专属：尺度极限
  { key: "micro", emoji: "🔬", alias: "微观尺度" },
  { key: "molecular", emoji: "⚛️", alias: "分子尺度" },
  { key: "atomic", emoji: "🧪", alias: "原子尺度" },
  { key: "subatomic", emoji: "🌌", alias: "亚原子" },
  { key: "cosmic", emoji: "🪐", alias: "宇宙尺度" },
  { key: "daily", emoji: "☀️", alias: "日常生活" },
  { key: "daily_item", emoji: "🎒", alias: "日常物品" },
  { key: "entertainment", emoji: "🎬", alias: "娱乐" },
  { key: "school", emoji: "🏫", alias: "校园" },
  { key: "time", emoji: "⏰", alias: "时间" },
];

function categoryDisplay(key: string): { emoji: string; label: string } {
  const hit = CATEGORY_EMOJI.find((c) => c.key === key);
  if (hit) return { emoji: hit.emoji, label: hit.alias ?? key };
  return { emoji: "✨", label: key };
}

// 表单里展示的 chip 顺序：先按 CATEGORY_EMOJI 列表的顺序排，列表里没出现的接在最后。
function orderCategoriesForPicker(categories: string[]): string[] {
  const priority = new Map(
    CATEGORY_EMOJI.map((c, i) => [c.key, i] as const),
  );
  return [...categories].sort((a, b) => {
    const pa = priority.get(a) ?? 999;
    const pb = priority.get(b) ?? 999;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

// 给孩子的"造物灵感"占位词（每次刷新随机一个，激发想象）
const EXAMPLE_PROMPTS = [
  "充电宝",
  "菠萝包",
  "滑板车",
  "彩虹糖",
  "外星花",
  "会飞的鞋",
  "南瓜灯",
  "弹弓",
  "魔法笔",
  "雪糕",
  "棒棒糖",
  "纸飞机",
];

function pickExample(): string {
  return EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
}

interface CreateResult {
  status: "idle" | "running" | "ok" | "error";
  id?: string;
  label?: string;
  url?: string;
  category?: string;
  message?: string;
}

// ─────────────────────────────────────────────────────────────
// 顶部返回栏（与其它儿童页保持一致风格）
// ─────────────────────────────────────────────────────────────
function HomeBackBar() {
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "20px 24px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link
        href="/"
        className="font-display"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 18px",
          borderRadius: 999,
          background: "#fff",
          border: "2px solid #EFE3C2",
          color: "#6B5A3C",
          fontSize: 15,
          textDecoration: "none",
          boxShadow: "0 2px 0 rgba(180,155,95,0.18)",
        }}
      >
        <span aria-hidden style={{ fontSize: 16 }}>
          🏠
        </span>
        回首页
      </Link>

      <span
        className="font-display"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 999,
          background: "#F4EEFF",
          color: "#7B4FD1",
          border: "1.5px solid #B57BFF55",
          fontSize: 14,
          letterSpacing: "0.06em",
          fontWeight: 700,
        }}
      >
        <span aria-hidden style={{ fontSize: 14 }}>
          🎨
        </span>
        造物小工坊
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 创造区：输入物品名 + 分类 chip + 大按钮
// ─────────────────────────────────────────────────────────────
function CreatePanel({
  categories,
  onCreated,
}: {
  categories: string[];
  onCreated: (item: { id: string; label: string; url: string; category: string }) => void;
}) {
  const orderedCats = React.useMemo(
    () => orderCategoriesForPicker(categories),
    [categories],
  );
  const [label, setLabel] = React.useState("");
  const [category, setCategory] = React.useState<string>(
    orderedCats[0] ?? "",
  );
  const [example, setExample] = React.useState(pickExample);
  const [state, setState] = React.useState<CreateResult>({ status: "idle" });

  // "尺博士正在画……"等待中的小尾巴动画用一个 tick state
  const [waitingDots, setWaitingDots] = React.useState(0);
  React.useEffect(() => {
    if (state.status !== "running") return;
    const t = setInterval(() => setWaitingDots((n) => (n + 1) % 4), 500);
    return () => clearInterval(t);
  }, [state.status]);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (state.status === "running") return;
      const name = label.trim();
      if (!name) {
        setState({ status: "error", message: "先想一个东西的名字吧～" });
        return;
      }
      if (!category) {
        setState({ status: "error", message: "选一个分类吧" });
        return;
      }
      setState({ status: "running" });
      try {
        const res = await fetch(resolveAsset("/api/dev/icons/create"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: name, category }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          id?: string;
          url?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.id || !data.url) {
          setState({
            status: "error",
            message:
              data.error?.includes("baker")
                ? "尺博士在睡午觉…等一会儿再试试"
                : (data.error ?? "出了点小问题，再试一次吧"),
          });
          return;
        }
        setState({
          status: "ok",
          id: data.id,
          label: name,
          url: data.url,
          category,
        });
        onCreated({
          id: data.id,
          label: name,
          url: data.url,
          category,
        });
        // 清空输入，方便接着造
        setLabel("");
        setExample(pickExample());
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "网络好像断了",
        });
      }
    },
    [label, category, state.status, onCreated],
  );

  const running = state.status === "running";

  return (
    <section
      style={{
        background:
          "linear-gradient(180deg, #FAF4FF 0%, #F4EEFF 100%)",
        border: "2px solid #D8C4F5",
        borderRadius: 28,
        padding: "26px 28px 28px",
        boxShadow: "0 4px 0 rgba(150, 110, 220, 0.12)",
      }}
    >
      <div
        className="font-display"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span aria-hidden style={{ fontSize: 28 }}>
          🦉
        </span>
        <h2
          style={{
            fontSize: 22,
            color: "#5C3FA7",
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          你想造一个什么？
        </h2>
      </div>
      <p
        style={{
          margin: "0 0 18px 4px",
          fontSize: 14,
          color: "#7A6AA0",
          lineHeight: 1.6,
        }}
      >
        告诉尺博士，它会用小画笔帮你画出来✨
      </p>

      <form onSubmit={submit}>
        {/* 输入框 */}
        <label
          style={{
            display: "block",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 13,
              color: "#7A6AA0",
              marginBottom: 6,
              paddingLeft: 4,
            }}
          >
            物品的名字
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`比如：${example}`}
            disabled={running}
            maxLength={20}
            className="font-display"
            style={{
              width: "100%",
              padding: "14px 18px",
              fontSize: 18,
              borderRadius: 16,
              border: "2.5px solid #D8C4F5",
              background: "#fff",
              outline: "none",
              color: "#2A1F4A",
              boxShadow: "0 2px 0 rgba(150, 110, 220, 0.12)",
            }}
          />
        </label>

        {/* 分类 chips */}
        <div style={{ marginBottom: 22 }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              color: "#7A6AA0",
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            它是哪一类？
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {orderedCats.map((c) => {
              const { emoji, label: catLabel } = categoryDisplay(c);
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  disabled={running}
                  className="font-display"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    fontSize: 14,
                    borderRadius: 999,
                    border: active
                      ? "2px solid #7B4FD1"
                      : "2px solid #E6D6F8",
                    background: active ? "#7B4FD1" : "#fff",
                    color: active ? "#fff" : "#5C3FA7",
                    cursor: running ? "not-allowed" : "pointer",
                    opacity: running ? 0.55 : 1,
                    transition: "all 0.15s",
                    fontWeight: 700,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 16 }}>
                    {emoji}
                  </span>
                  {catLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* 提交按钮 + 状态 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            disabled={running}
            className="font-display"
            style={{
              padding: "14px 36px",
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 999,
              border: "none",
              background: running ? "#B59FE0" : "#7B4FD1",
              color: "#fff",
              cursor: running ? "wait" : "pointer",
              boxShadow: running
                ? "none"
                : "0 4px 0 #5C3FA7",
              transform: running ? "translateY(2px)" : "none",
              transition: "transform 0.1s",
              letterSpacing: "0.05em",
            }}
          >
            {running ? (
              <>尺博士正在画{".".repeat(waitingDots)}</>
            ) : (
              <>造一个！</>
            )}
          </button>

          {/* 状态提示 */}
          {state.status === "running" && (
            <span
              style={{
                fontSize: 13,
                color: "#7A6AA0",
                lineHeight: 1.6,
              }}
            >
              第一次画会等久一点（30 秒左右），后面就快啦
            </span>
          )}
          {state.status === "error" && state.message && (
            <span
              style={{
                fontSize: 14,
                color: "#D14F6B",
                fontWeight: 700,
              }}
            >
              😯 {state.message}
            </span>
          )}
        </div>
      </form>

      {/* 成功揭幕区 */}
      {state.status === "ok" && state.url && state.label && (
        <RevealCard
          url={state.url}
          label={state.label}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 揭幕卡：成功后大图展示
// ─────────────────────────────────────────────────────────────
function RevealCard({ url, label }: { url: string; label: string }) {
  const [enlarged, setEnlarged] = React.useState(false);

  React.useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

  return (
    <>
      <div
        style={{
          marginTop: 22,
          background: "#fff",
          border: "2.5px solid #B57BFF",
          borderRadius: 22,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 22,
          boxShadow: "0 4px 0 rgba(150, 110, 220, 0.15)",
        }}
      >
        <div
          onClick={() => setEnlarged(true)}
          style={{
            width: 120,
            height: 120,
            flexShrink: 0,
            background:
              "linear-gradient(180deg, #FFFCF4 0%, #FFF5E0 100%)",
            borderRadius: 16,
            border: "2px solid #EFE3C2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
            cursor: "zoom-in",
          }}
          title={`点击放大查看：${label}`}
        >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAsset(url)}
          alt={label}
          style={{
            width: "82%",
            height: "82%",
            objectFit: "contain",
            imageRendering: "pixelated",
          }}
        />
        <span 
          style={{
            position: "absolute",
            bottom: 4,
            right: 6,
            fontSize: 8,
            color: "white",
            opacity: 0.8,
            fontFamily: '"Alibaba PuHuiTi", sans-serif',
            pointerEvents: "none",
            userSelect: "none",
            transform: "scale(0.85)",
            transformOrigin: "bottom right",
          }}
        >
          AI生成
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-display"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            background: "#F4EEFF",
            color: "#7B4FD1",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          <span aria-hidden>✨</span>
          新出炉
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#2A1F4A",
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#7A6AA0",
            lineHeight: 1.6,
          }}
        >
          画好啦！它已经住进尺博士的字典里，你可以在「万物量量看」找到它～
        </div>
      </div>
    </div>

    {/* 点击放大灯箱 */}
    {enlarged && (
      <div
        role="dialog"
        aria-label={`放大查看：${label}`}
        onClick={() => setEnlarged(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20, 14, 40, 0.72)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: 24,
          animation: "kidstudio-fade 0.18s ease-out",
          cursor: "zoom-out",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            animation: "kidstudio-pop 0.2s ease-out",
            maxWidth: "90vw",
            maxHeight: "90vh",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAsset(url)}
            alt={label}
            style={{
              width: 360,
              maxWidth: "80vw",
              maxHeight: "65vh",
              objectFit: "contain",
              imageRendering: "pixelated",
            }}
          />
          <span
            className="font-display"
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#2A1F4A",
            }}
          >
            {label}
          </span>
        </div>
      </div>
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 画廊：分类展示已有物品
// ─────────────────────────────────────────────────────────────
const INITIAL_PER_CATEGORY = 12;

function Gallery({ groups }: { groups: Group[] }) {
  const total = React.useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups],
  );

  // 重新生成后，PNG 文件本身在 /icons/pixel/<id>.png 没变，但浏览器会缓存旧图。
  // 这里维护 id → "?t=xxx" 时间戳，叠加到 url 后强制刷新。
  // 同时把新的 prompt 也存下来，让用户再次打开灯箱编辑时看到最新值。
  const [overrides, setOverrides] = React.useState<
    Record<string, { url?: string; prompt?: string }>
  >({});

  // 套用 overrides 后的分组——同时供瓦片网格和灯箱使用，确保重画后两处都刷新。
  const effectiveGroups = React.useMemo<Group[]>(() => {
    if (Object.keys(overrides).length === 0) return groups;
    return groups.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        const ov = overrides[it.id];
        if (!ov) return it;
        return {
          ...it,
          url: ov.url ?? it.url,
          prompt: ov.prompt ?? it.prompt,
        };
      }),
    }));
  }, [groups, overrides]);

  // 把 effectiveGroups 拍平做灯箱浏览的导航序列。即使某分类被折叠，灯箱里
  // 也能左右切到那张图——比限制成"只在当前可见"更符合直觉。
  const flatItems = React.useMemo(
    () => effectiveGroups.flatMap((g) => g.items),
    [effectiveGroups],
  );
  const indexById = React.useMemo(() => {
    const m = new Map<string, number>();
    flatItems.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [flatItems]);

  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(
    null,
  );

  const openById = React.useCallback(
    (id: string) => {
      const i = indexById.get(id);
      if (i !== undefined) setLightboxIndex(i);
    },
    [indexById],
  );

  // 灯箱重画成功后回调：更新 url（带 cache-bust）和最新 prompt
  const handleRegenerated = React.useCallback(
    (id: string, url: string, prompt?: string) => {
      setOverrides((prev) => ({
        ...prev,
        [id]: { url, prompt },
      }));
    },
    [],
  );

  return (
    <section
      style={{
        background: "#FFFAEF",
        border: "2px solid #EFE3C2",
        borderRadius: 28,
        padding: "26px 28px 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <span
          className="font-display"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#FFF3D6",
            color: "#A8853A",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 14,
            letterSpacing: "0.06em",
            fontWeight: 700,
            border: "1.5px solid #A8853A33",
          }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>
            📚
          </span>
          尺博士的物品图鉴
        </span>
        <span
          style={{
            fontSize: 14,
            color: "var(--foreground)",
            opacity: 0.55,
          }}
        >
          已经会画 {total} 样东西，你也来造一个吧！
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {effectiveGroups.map((g) => (
          <CategorySection
            key={g.category}
            group={g}
            onOpen={openById}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={flatItems}
          index={lightboxIndex}
          onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onRegenerated={handleRegenerated}
        />
      )}
    </section>
  );
}

function CategorySection({
  group,
  onOpen,
}: {
  group: Group;
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const { emoji, label } = categoryDisplay(group.category);
  const shown = expanded
    ? group.items
    : group.items.slice(0, INITIAL_PER_CATEGORY);
  const hasMore = group.items.length > INITIAL_PER_CATEGORY;

  return (
    <div>
      <div
        className="font-display"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          paddingLeft: 4,
        }}
      >
        <span aria-hidden style={{ fontSize: 20 }}>
          {emoji}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#6B5A3C",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "var(--foreground)",
            opacity: 0.45,
            fontWeight: 700,
          }}
        >
          {group.items.length}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 10,
        }}
      >
        {shown.map((it) => (
          <GalleryTile
            key={it.id}
            item={it}
            onClick={() => onOpen(it.id)}
          />
        ))}
      </div>

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-display"
            style={{
              padding: "6px 18px",
              borderRadius: 999,
              border: "2px solid #E8DCB8",
              background: "#fff",
              color: "#6B5A3C",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {expanded
              ? "收起"
              : `看更多（还有 ${group.items.length - INITIAL_PER_CATEGORY} 样）`}
          </button>
        </div>
      )}
    </div>
  );
}

function GalleryTile({
  item,
  onClick,
}: {
  item: IconItem;
  onClick?: () => void;
}) {
  const [ok, setOk] = React.useState(true);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`点击放大查看：${item.label}`}
      style={{
        background: "#fff",
        border: "2px solid #EFE3C2",
        borderRadius: 14,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        boxShadow: "0 1px 0 rgba(180,155,95,0.12)",
        cursor: onClick ? "zoom-in" : "default",
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          background:
            "linear-gradient(180deg, #FFFCF4 0%, #FFF5E0 100%)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {ok ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveAsset(item.url)}
              alt={item.label}
              onError={() => setOk(false)}
              style={{
                width: "82%",
                height: "82%",
                objectFit: "contain",
                imageRendering: "pixelated",
              }}
            />
            <span 
              style={{
                position: "absolute",
                bottom: 4,
                right: 6,
                fontSize: 8,
                color: "white",
                opacity: 0.8,
                fontFamily: '"Alibaba PuHuiTi", sans-serif',
                pointerEvents: "none",
                userSelect: "none",
                transform: "scale(0.85)",
                transformOrigin: "bottom right",
              }}
            >
              AI生成
            </span>
          </>
        ) : (
          <span
            aria-hidden
            style={{ fontSize: 28, opacity: 0.5 }}
          >
            ❓
          </span>
        )}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#2A1F4A",
          textAlign: "center",
          lineHeight: 1.25,
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={item.label}
      >
        {item.label}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 灯箱：点击瓦片后全屏放大查看 + 左右切换
//
// 设计点：
//   - 大背景遮罩 + 居中卡片，点遮罩任意空白处即可关闭
//   - 左右按钮做成圆形大色块，方便小朋友点
//   - 键盘支持 ←/→/Esc，桌面端浏览器更顺手
//   - 卡片内放大到 ~360px，pixelated 渲染保持锐利
//   - 显示"第 N / M 张"小角标，让孩子有"翻图鉴"的乐趣
// ─────────────────────────────────────────────────────────────
function Lightbox({
  items,
  index,
  onChange,
  onClose,
  onRegenerated,
}: {
  items: IconItem[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
  onRegenerated?: (id: string, url: string, prompt?: string) => void;
}) {
  const total = items.length;
  const item = items[index];

  // —— 重画相关 state（按 item.id 区分；切换图片时自动重置）——
  const [editing, setEditing] = React.useState(false);
  const [draftPrompt, setDraftPrompt] = React.useState("");
  const [regenStatus, setRegenStatus] = React.useState<
    "idle" | "running" | "ok" | "error"
  >("idle");
  const [regenError, setRegenError] = React.useState<string | null>(null);
  // 真实进度：来自 SSE 的 progress 事件。
  //   stage = encode → 15%；denoise i/N → 15% + 70%·(i/N)；decode → 90%；done → 100%
  // 这样既能反映 4 步去噪的真实节奏，又留出 encode（前 ~1s）和 decode（后 ~1s）
  // 的 buffer，看起来不会"刷地一下到 100% 然后等很久才换图"。
  const [progress, setProgress] = React.useState({
    pct: 0,
    label: "",
  });
  const [elapsed, setElapsed] = React.useState(0);

  // 切换图片时清掉重画 UI 状态
  React.useEffect(() => {
    setEditing(false);
    setRegenStatus("idle");
    setRegenError(null);
    setDraftPrompt(item?.prompt ?? "");
    setElapsed(0);
    setProgress({ pct: 0, label: "" });
  }, [item?.id, item?.prompt]);

  // 进度条心跳：纯计秒，给"已用 Xs"用；进度条本身由 SSE 真实事件驱动
  React.useEffect(() => {
    if (regenStatus !== "running") return;
    const start = Date.now();
    const t = window.setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 250);
    return () => window.clearInterval(t);
  }, [regenStatus]);

  const go = React.useCallback(
    (delta: number) => {
      const next = (index + delta + total) % total;
      onChange(next);
    },
    [index, total, onChange],
  );

  const handleRegen = React.useCallback(async () => {
    if (!item) return;
    setRegenStatus("running");
    setRegenError(null);
    setElapsed(0);
    setProgress({ pct: 2, label: "尺博士想想…" });

    const trimmed = draftPrompt.trim();
    const body: Record<string, unknown> = { id: item.id };
    if (trimmed.length > 0) body.prompt = trimmed;

    try {
      const resp = await fetch(resolveAsset("/api/dev/icons/regenerate"), {
        method: "POST",
        // 关键：服务端会根据 Accept 切换到 SSE 流式响应
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok || !resp.body) {
        // 服务端可能在 SSE 启动前已直接 400/500，按 JSON 兜底解析
        let errMsg = `HTTP ${resp.status}`;
        try {
          const j = (await resp.json()) as { error?: string };
          if (j.error) errMsg = j.error;
        } catch {
          /* not json */
        }
        throw new Error(errMsg);
      }

      // ── SSE 解析 ──
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalUrl: string | null = null;
      let finalError: string | null = null;

      const handleEvent = (raw: string) => {
        // 一条 SSE 事件可能跨多行；只关心 `data: ...`
        const dataLines: string[] = [];
        for (const ln of raw.split("\n")) {
          if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trimStart());
        }
        if (dataLines.length === 0) return;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
        } catch {
          return;
        }
        const evt = String(payload.event ?? "");
        if (evt === "progress") {
          const stage = String(payload.stage ?? "denoise");
          const step = Number(payload.step ?? 0);
          const total = Number(payload.total ?? 4);
          if (stage === "encode") {
            setProgress({ pct: 15, label: "理解提示词…" });
          } else if (stage === "denoise") {
            const pct = 15 + Math.round((step / total) * 70); // 15% → 85%
            setProgress({
              pct,
              label: `画第 ${step} / ${total} 笔…`,
            });
          } else if (stage === "decode") {
            setProgress({ pct: 90, label: "上色 + 修边…" });
          }
        } else if (evt === "done") {
          finalUrl = String(payload.url ?? "");
          setProgress({ pct: 100, label: "完成！" });
        } else if (evt === "error") {
          finalError = String(payload.error ?? "unknown");
        }
      };

      // 流读循环：每收到 chunk，按双换行 `\n\n` 切事件
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          handleEvent(raw);
        }
      }
      // flush 残余
      if (buf.trim()) handleEvent(buf);

      if (finalError) throw new Error(finalError);
      if (!finalUrl) throw new Error("服务端没有返回新图地址");
      setRegenStatus("ok");
      onRegenerated?.(
        item.id,
        finalUrl,
        trimmed.length > 0 ? trimmed : undefined,
      );
      setEditing(false);
    } catch (e) {
      setRegenStatus("error");
      setRegenError(e instanceof Error ? e.message : String(e));
    }
  }, [item, draftPrompt, onRegenerated]);

  // 键盘导航 + Esc 关闭（编辑中不拦截方向键，避免抢 textarea 焦点）
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) setEditing(false);
        else onClose();
        return;
      }
      // 在 textarea 内不接管方向键 / Enter
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "textarea" || tag === "input") return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, editing]);

  // 锁滚动
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-label={`放大查看：${item.label}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 14, 40, 0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
        animation: "kidstudio-fade 0.18s ease-out",
      }}
    >
      <style>{`
        @keyframes kidstudio-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kidstudio-pop {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* 左切换 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          go(-1);
        }}
        aria-label="上一张"
        disabled={total <= 1}
        style={{
          position: "absolute",
          left: 24,
          top: "50%",
          transform: "translateY(-50%)",
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "none",
          background: "#fff",
          color: "#5C3FA7",
          fontSize: 28,
          fontWeight: 900,
          cursor: total <= 1 ? "not-allowed" : "pointer",
          opacity: total <= 1 ? 0.35 : 1,
          boxShadow: "0 4px 0 rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ‹
      </button>

      {/* 右切换 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          go(1);
        }}
        aria-label="下一张"
        disabled={total <= 1}
        style={{
          position: "absolute",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "none",
          background: "#fff",
          color: "#5C3FA7",
          fontSize: 28,
          fontWeight: 900,
          cursor: total <= 1 ? "not-allowed" : "pointer",
          opacity: total <= 1 ? 0.35 : 1,
          boxShadow: "0 4px 0 rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ›
      </button>

      {/* 关闭 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="关闭"
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "none",
          background: "#fff",
          color: "#2A1F4A",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 3px 0 rgba(0,0,0,0.25)",
        }}
      >
        ✕
      </button>

      {/* 主卡片 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 28,
          border: "3px solid #fff",
          padding: 28,
          maxWidth: "min(560px, 92vw)",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          boxShadow: "0 10px 32px rgba(0,0,0,0.35)",
          animation: "kidstudio-pop 0.22s ease-out",
        }}
      >
        <div
          style={{
            width: "min(360px, 70vw)",
            height: "min(360px, 70vw)",
            background:
              "linear-gradient(180deg, #FFFCF4 0%, #FFF5E0 100%)",
            border: "2px solid #EFE3C2",
            borderRadius: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAsset(item.url)}
            alt={item.label}
            style={{
              width: "82%",
              height: "82%",
              objectFit: "contain",
              imageRendering: "pixelated",
            }}
          />
          <span 
            style={{
              position: "absolute",
              bottom: 10,
              right: 12,
              fontSize: 10,
              color: "white",
              opacity: 0.8,
              fontFamily: '"Alibaba PuHuiTi", sans-serif',
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            AI生成
          </span>
        </div>

        <div
          className="font-display"
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#2A1F4A",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          {item.label}
        </div>

        <div
          className="font-display"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 14px",
            borderRadius: 999,
            background: "#F4EEFF",
            color: "#7B4FD1",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          第 {index + 1} / {total} 张
        </div>

        {/* ── 重新生成入口 ──
            理由：FLUX 偶尔会画偏（例如"芝麻拼成的大芝麻"），让孩子也能
            自己再让尺博士画一次；高阶玩家可点开"教尺博士怎么画"改 prompt。
        */}
        {regenStatus !== "running" && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (editing) {
                  // 已展开 → 直接触发烤图
                  void handleRegen();
                } else {
                  // 未展开 → 第一次点：直接快烤（不改 prompt）
                  void handleRegen();
                }
              }}
              className="font-display"
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(180deg, #8B5CF6 0%, #6D3FD6 100%)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 3px 0 rgba(76, 39, 153, 0.45)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span aria-hidden>🎨</span>
              再画一张
            </button>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="font-display"
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "2px solid #C9B8F5",
                background: "#fff",
                color: "#5C3FA7",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {editing ? "收起提示词" : "教尺博士怎么画 ✏️"}
            </button>
          </div>
        )}

        {/* ── 提示词编辑（高阶玩家用，默认折叠） ── */}
        {editing && regenStatus !== "running" && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              className="font-display"
              style={{
                fontSize: 12,
                color: "#5C3FA7",
                fontWeight: 700,
                paddingLeft: 4,
              }}
            >
              告诉尺博士这次怎么画（英文效果更好；留空就用上次的）
            </label>
            <textarea
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              placeholder={
                item.prompt ??
                "比如：one single sesame seed, macro close-up, pale beige"
              }
              rows={3}
              style={{
                width: "100%",
                borderRadius: 14,
                border: "2px solid #E2D6FB",
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.5,
                color: "#2A1F4A",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* ── 进度条 ──
            sequential_cpu_offload 下单张 ~12-18s。API 不是流式，无法报真实进度，
            用"伪进度"+秒数让孩子知道在算。封顶到 95%，避免比真实时间快到位。
        */}
        {regenStatus === "running" && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 14,
                color: "#5C3FA7",
                fontWeight: 700,
              }}
            >
              🦉 {progress.label || "尺博士准备画笔…"}
            </div>
            <div
              style={{
                width: "100%",
                height: 12,
                background: "#F0E9FE",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress.pct}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #8B5CF6 0%, #C084FC 100%)",
                  // 真实进度跳变较大（每去噪步骤 +17.5%），用 0.4s 平滑过渡
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--foreground)",
                opacity: 0.5,
              }}
            >
              {progress.pct}% · 已用时 {elapsed.toFixed(1)}s
            </div>
          </div>
        )}

        {regenStatus === "ok" && (
          <div
            className="font-display"
            style={{
              fontSize: 13,
              color: "#1F8A4C",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span aria-hidden>✨</span>
            画好啦！是不是更像了？
          </div>
        )}

        {regenStatus === "error" && (
          <div
            style={{
              fontSize: 12,
              color: "#C9412C",
              background: "#FFEEE9",
              border: "1.5px solid #FFCBBA",
              padding: "8px 12px",
              borderRadius: 12,
              maxWidth: "100%",
              wordBreak: "break-word",
              lineHeight: 1.5,
            }}
          >
            尺博士没画出来：{regenError}
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            color: "var(--foreground)",
            opacity: 0.5,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          按 ← → 切换 · 按 Esc 关闭
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────────
export function KidStudio({
  groups: initialGroups,
  categories,
}: {
  groups: Group[];
  categories: string[];
}) {
  // 把"新造出来的"动态加进对应分类的最前面，让孩子立刻在画廊里看到自己的作品。
  const [groups, setGroups] = React.useState<Group[]>(initialGroups);

  const handleCreated = React.useCallback(
    (it: { id: string; label: string; url: string; category: string }) => {
      setGroups((prev) => {
        const next = prev.map((g) => ({ ...g, items: [...g.items] }));
        const idx = next.findIndex((g) => g.category === it.category);
        const newItem: IconItem = {
          id: it.id,
          label: it.label,
          category: it.category,
          url: `${it.url}${it.url.includes("?") ? "&" : "?"}t=${Date.now()}`,
        };
        if (idx >= 0) {
          // 同 id 已经在了就替换（更新缓存），否则插到最前
          const existing = next[idx].items.findIndex(
            (x) => x.id === it.id,
          );
          if (existing >= 0) next[idx].items[existing] = newItem;
          else next[idx].items.unshift(newItem);
        } else {
          next.unshift({ category: it.category, items: [newItem] });
        }
        return next;
      });
    },
    [],
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background, #FFF8E7)",
        paddingBottom: 64,
      }}
    >
      <HomeBackBar />

      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "22px 24px 0",
        }}
      >
        {/* 大标题 */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <h1
            className="font-display"
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#2A1F4A",
              margin: "0 0 8px",
              letterSpacing: "0.02em",
            }}
          >
            造物小工坊 🎨
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              color: "var(--foreground)",
              opacity: 0.65,
              lineHeight: 1.6,
            }}
          >
            说出一个东西的名字，尺博士就帮你画出来！
            <br />
            画好的东西会住进字典，你下次量东西的时候还能再用它～
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <CreatePanel
            categories={categories}
            onCreated={handleCreated}
          />
          <Gallery groups={groups} />
        </div>
      </div>
    </main>
  );
}
