import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FloorPlanProof } from "@/components/exterior-preview/floor-plan-proof";
import { planProofPath } from "@/lib/exterior-preview/plan-proof-address";
import { isLocalPreviewRequest, localPreviewEnabled } from "../local-access";
import { readFloorApartments } from "./apartment-source";
import { loadProofFloors, readPlanPolygons } from "./plan-source";

export const metadata: Metadata = {
  title: "Močire H — tlocrti i stanovi",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { viewportFit: "cover" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FloorPlanProofPage({ searchParams }: PageProps) {
  if (!localPreviewEnabled()) notFound();
  if (!isLocalPreviewRequest(await headers())) notFound();
  const query = await searchParams;
  const proofFloors = await loadProofFloors();
  const floor = proofFloors.find(level => level.floor_id === query.floor);
  const plan = floor?.plans.find(item => item.variant === (query.plan ?? "main"));
  if (!floor || !plan) notFound();

  const [polygons, apartments] = await Promise.all([
    readPlanPolygons(floor, plan),
    readFloorApartments(floor.floor_id, floor.unit_ids),
  ]);
  return (
    <FloorPlanProof
      key={plan.image_id}
      floorId={floor.floor_id}
      label={floor.label}
      floors={proofFloors.map(({ floor_id, label }) => ({ id: floor_id, label }))}
      hasGallery={floor.plans.some(item => item.variant === "gallery")}
      unitIds={floor.unit_ids}
      apartments={apartments}
      drawing={{
        id: plan.image_id,
        variant: plan.variant,
        width: plan.width_px,
        height: plan.height_px,
        viewBox: plan.viewBox,
        src: `${planProofPath}/media/${plan.image_id}.webp`,
        polygons,
      }}
    />
  );
}
