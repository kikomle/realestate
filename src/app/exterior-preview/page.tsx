import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExteriorExplorer } from "@/components/exterior-preview/exterior-explorer";
import { readExteriorAddress, type ExteriorFloor } from "@/components/exterior-preview/selection";
import { exteriorImages } from "./exterior-media";
import { isLocalPreviewRequest, localPreviewEnabled } from "./local-access";
import { loadProofFloors } from "./plans/plan-source";

export const metadata: Metadata = {
  title: "Močire — Zadar H",
  description: "Privatni prikaz pročelja stambene zgrade Močire H u Zadru.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { viewportFit: "cover" };

type PreviewProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExteriorPreviewPage({ searchParams }: PreviewProps) {
  if (!localPreviewEnabled()) notFound();
  if (!isLocalPreviewRequest(await headers())) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  // Send the working floor form in the first HTML, not behind a streamed fallback.
  const floors: ExteriorFloor[] = (await loadProofFloors()).map(floor => ({
    id: floor.floor_id,
    label: floor.label,
    plans: floor.plans.map(plan => ({ imageId: plan.image_id, variant: plan.variant, sha256: plan.sha256 })),
  }));
  const initial = readExteriorAddress(query, new Set(floors.map(floor => floor.id)));
  return <ExteriorExplorer images={exteriorImages} floors={floors} initial={initial} />;
}
