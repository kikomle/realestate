import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FloorInventory, FloorPlanRecord, FloorRecord } from "@/lib/exterior-preview/inventory-types";
import { readPreviewInventory } from "../private-inventory";

export type PlanPolygon = { unitId: string; points: string };

export async function loadProofFloors(): Promise<FloorRecord[]> {
  return (await readPreviewInventory<FloorInventory>("floors"))?.floors ?? [];
}

export async function findProofPlan(imageId: string) {
  return (await loadProofFloors()).flatMap(floor => floor.plans).find(plan => plan.image_id === imageId);
}

export async function readPinnedAsset(path: string, sha256: string) {
  // Both arguments come from the checked-in plan manifest, never the URL.
  // These local-only files must not enter the production server trace.
  const bytes = await readFile(join(/* turbopackIgnore: true */ process.cwd(), path));
  return createHash("sha256").update(bytes).digest("hex") === sha256 ? bytes : null;
}

export async function readPlanPolygons(floor: FloorRecord, plan: FloorPlanRecord): Promise<PlanPolygon[] | null> {
  try {
    const bytes = await readPinnedAsset(plan.private_overlay, plan.overlay_sha256);
    if (!bytes) return null;
    // Read the pinned Stage 2 export format. Never send its markup to the client.
    const svg = bytes.toString("utf8");
    const header = /<svg\b[^>]*\bviewBox="([^"]+)"[^>]*\bdata-plan-sha256="([^"]+)"[^>]*\bdata-level="([^"]+)"/.exec(svg);
    if (header?.[1] !== plan.viewBox || header[2] !== plan.sha256 || header[3] !== floor.floor_id ||
        plan.viewBox !== `0 0 ${plan.width_px} ${plan.height_px}`) return null;

    const polygons = [...svg.matchAll(/<polygon data-unit-id="(H [0-9]+\.[0-9]+)" points="((?:\d+(?:\.\d+)?,\d+(?:\.\d+)? ?)+)"/g)]
      .map(([, unitId, points]) => ({ unitId, points }));
    const ids = new Set(polygons.map(polygon => polygon.unitId));
    if (polygons.length !== plan.registered_units || polygons.length !== floor.unit_ids.length ||
        ids.size !== polygons.length || !floor.unit_ids.every(id => ids.has(id))) return null;
    return polygons;
  } catch {
    return null;
  }
}
