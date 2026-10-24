import { notFound } from "next/navigation";
import { getDimension, type DimensionKey } from "@/lib/dimensions";
import { ChallengeClient } from "./ChallengeClient";

export default async function ChallengePage(
  props: PageProps<"/play/[dimension]/challenge">,
) {
  const { dimension } = await props.params;
  const dim = getDimension(dimension as DimensionKey);
  if (!dim || !dim.available) notFound();

  return <ChallengeClient dimensionKey={dim.key} dimensionLabel={dim.label} />;
}
