/**
 * /play/[dimension]/dictionary — "量感字典"
 *
 * 顶部用通用 DimensionTabBar 切维度；正文为 DictionaryStage（客户端）。
 * 当前精选数据仅覆盖 length；其它维度由 DictionaryStage 内部展示"敬请期待"。
 */
import { notFound } from "next/navigation";
import { getDimension, type DimensionKey } from "@/lib/dimensions";
import { DimensionTabBar } from "@/components/DimensionTabBar";
import { DictionaryStage } from "@/components/DictionaryStage";

export default async function DictionaryPage(
  props: PageProps<"/play/[dimension]/dictionary">,
) {
  const { dimension } = await props.params;
  const dim = getDimension(dimension as DimensionKey);
  if (!dim || !dim.available) notFound();

  return (
    <main className="min-h-screen flex flex-col">
      <DimensionTabBar
        active={dim.key}
        mode="dictionary"
        titleTemplate="翻一翻量感字典{label}"
        modeBadge={{ label: "量感字典", emoji: "📖" }}
      />

      <DictionaryStage dimension={dim.key} dimensionLabel={dim.label} />
    </main>
  );
}
