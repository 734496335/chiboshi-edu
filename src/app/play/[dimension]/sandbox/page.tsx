/**
 * /play/[dimension]/sandbox — "万物量量看"
 *
 * 信息架构 v2：
 *   首页 → 选模式（sandbox） → 进来后顶栏切换"长度/面积/容积/体积/重量/时间"
 * URL 里的 [dimension] 决定当前激活的 tab；点别的 tab 直接换路由。
 */
import * as React from "react";
import { notFound } from "next/navigation";
import { getDimension, type DimensionKey } from "@/lib/dimensions";
import { SandboxStage } from "@/components/SandboxStage";
import { DimensionTabBar } from "@/components/DimensionTabBar";

export default async function SandboxPage(
  props: PageProps<"/play/[dimension]/sandbox">,
) {
  const { dimension } = await props.params;
  const dim = getDimension(dimension as DimensionKey);
  if (!dim || !dim.available) notFound();

  return (
    <main className="min-h-screen flex flex-col">
      <DimensionTabBar
        active={dim.key}
        mode="sandbox"
        titleTemplate="来学一学：{label}"
        modeBadge={{ label: "万物量量看", tone: "#FF9F43" }}
      />

      <React.Suspense fallback={null}>
        <SandboxStage dimension={dim.key} dimensionLabel={dim.label} />
      </React.Suspense>
    </main>
  );
}
