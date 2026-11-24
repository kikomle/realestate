import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ApartmentDetails } from "@/lib/exterior-preview/apartment-detail";
import type { ApartmentInventory, UnitRecord } from "@/lib/exterior-preview/inventory-types";
import { planProofPath } from "@/lib/exterior-preview/plan-proof-address";
import { readPreviewInventory } from "../private-inventory";

const sourceRoot = "assets/source/mocire-zadar-h";
const rightsId = "sigma-private-demo";
type Asset = {
  kind: string; unit_id: string | null; source_url: string; referrer: string;
  sha256: string; original_name: string; rights: string; width?: number; height?: number;
  optimized?: { path: string; sha256: string; width: number; height: number; profile: string };
};
type SourceRow = {
  naziv: string; link: string; povrsina: string; status: string; kontakt_stranica: string;
};
type Ledger = {
  building: string;
  project: string;
  rights: Record<string, { publication: string }>;
  assets: Asset[];
  floor_snapshots: { level: string; page_url: string; rows: SourceRow[] }[];
  pages: Record<string, { retrieved_at: string }>;
};

async function readSourceLedger(): Promise<Ledger | null> {
  try {
    const raw = await readFile(join(/* turbopackIgnore: true */ process.cwd(), sourceRoot, "stage2-manifest.json"), "utf8");
    const ledger = JSON.parse(raw) as Ledger;
    return ledger.building === "Močire Zadar H" && ledger.project === "https://www.sigma.hr/projekti/mocire-zadar-h/" &&
      ledger.rights?.[rightsId]?.publication === "NOT_CLEARED" &&
      Array.isArray(ledger.assets) && Array.isArray(ledger.floor_snapshots) && ledger.pages ? ledger : null;
  } catch {
    return null;
  }
}

function matchingSource(ledger: Ledger | null, unit: UnitRecord, kind: "unit-plan" | "sheet") {
  const expected = kind === "unit-plan" ? unit.unit_drawing : unit.sheet;
  const matches = ledger?.assets.filter(asset => asset.kind === kind && asset.unit_id === unit.unit_id) ?? [];
  const [asset] = matches;
  return matches.length === 1 && asset.rights === rightsId && asset.referrer === unit.source_ref &&
    asset.original_name === expected.original_name && asset.source_url === expected.source_url &&
    asset.sha256 === expected.sha256 ? asset : null;
}

function planAsset(ledger: Ledger | null, unit: UnitRecord) {
  const source = matchingSource(ledger, unit, "unit-plan");
  const file = source?.optimized;
  if (!source || !file || file.profile !== "lossless-webp-native-no-crop" ||
      !Number.isSafeInteger(file.width) || !Number.isSafeInteger(file.height) ||
      file.width <= 0 || file.height <= 0 || file.width !== source.width || file.height !== source.height ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !/^Mocire-Zadar-H-[\w.-]+\.png$/.test(source.original_name) ||
      file.path !== `raw/stage2/webp/${source.original_name.slice(0, -4)}-${source.sha256.slice(0, 12)}.webp`) return null;
  return { ...file, path: `${sourceRoot}/${file.path}` };
}

const mediaName = (unitId: string) => `${unitId.replace(" ", "-")}.webp`;

export async function lookupApartmentMedia(name: string) {
  if (!/^H-[0-4]\.\d{1,2}\.webp$/.test(name)) return null;
  const [data, ledger] = await Promise.all([
    readPreviewInventory<ApartmentInventory>("apartments"),
    readSourceLedger(),
  ]);
  const unit = data?.units.find(row => mediaName(row.unit_id) === name);
  return unit ? planAsset(ledger, unit) : null;
}

export async function readFloorApartments(floorId: string, unitIds: readonly string[]): Promise<ApartmentDetails[]> {
  const [data, ledger] = await Promise.all([
    readPreviewInventory<ApartmentInventory>("apartments"),
    readSourceLedger(),
  ]);
  const units = data?.units ?? [];
  const floor = ledger?.floor_snapshots.find(row => row.level === floorId);
  return unitIds.flatMap(id => {
    const unit = units.find(row => row.floor_id === floorId && row.unit_id === id);
    if (!unit) return [];
    const sourceRow = floor?.rows.find(row => row.naziv === unit.unit_id && row.link === unit.source_ref);
    const status: ApartmentDetails["status"] = floor && sourceRow?.status === unit.status && unit.status === unit.detail_page.facts.Status &&
      (unit.status === "Slobodno" || unit.status === "Prodano") &&
      unit.status_as_of === ledger?.pages[floor.page_url]?.retrieved_at && /^\d{4}-\d{2}-\d{2}T/.test(unit.status_as_of)
      ? { label: unit.status, date: unit.status_as_of.slice(0, 10) } : null;
    const file = planAsset(ledger, unit);
    const publisherPdf = matchingSource(ledger, unit, "sheet");
    return [{
      id,
      type: unit.unit_type_source_label,
      listingArea: unit.listing_area_raw,
      status,
      source: unit.source_ref,
      inquiry: sourceRow?.kontakt_stranica === "https://www.sigma.hr/upit-za-stan/" ? sourceRow.kontakt_stranica : null,
      pdf: publisherPdf && /^https:\/\/www\.sigma\.hr\/wp-content\/uploads\/[\w./-]+\.pdf$/i.test(publisherPdf.source_url)
        ? publisherPdf.source_url : null,
      plan: file ? { src: `${planProofPath}/unit-media/${mediaName(id)}`, width: file.width, height: file.height } : null,
      detailNP: unit.detail_page.np_total_m2,
      sheet: { np_total_m2: unit.sheet.np_total_m2, nkp_total_m2: unit.sheet.nkp_total_m2, rooms: unit.sheet.rooms },
      differences: {
        np: unit.flags.includes("DETAIL_AND_SHEET_NP_DIFFER"),
        nkp: unit.flags.includes("LISTING_AND_SHEET_NKP_DIFFER"),
      },
    }];
  });
}
