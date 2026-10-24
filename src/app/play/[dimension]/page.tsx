/**
 * /play/[dimension] — 旧的"模式选择"页，IA v2 已废弃。
 *
 * 现在首页直接选模式（sandbox / dictionary / challenge），所以这个 URL
 * 直接重定向到 /play/<dim>/sandbox，保留外部书签兼容。
 */
import { redirect } from "next/navigation";
import { getDimension, type DimensionKey } from "@/lib/dimensions";

export default async function PlayDimensionPage(
  props: PageProps<"/play/[dimension]">,
) {
  const { dimension } = await props.params;
  const dim = getDimension(dimension as DimensionKey);
  if (!dim || !dim.available) {
    // 不存在的维度直接回首页
    redirect("/");
  }
  redirect(`/play/${dim.key}/sandbox`);
}
