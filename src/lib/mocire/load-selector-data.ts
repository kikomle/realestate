import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AvailabilityStatus,
  ExteriorPhoto,
  FloorPlanDrawing,
  RoomEntry,
  SelectorDataset,
  SelectorFloor,
  SelectorUnit,
  UnitGeometry3D,
} from "./types";

const ROOM_COUNT_MAP: Record<string, number> = {
  Jednosoban: 1,
  Dvosoban: 2,
  Trosoban: 3,
  "Četverosoban": 4,
  Peterosoban: 5,
};

const SHORT_FLOOR_LABELS: Record<string, string> = {
  L00: "0",
  L01: "1",
  L02: "2",
  L03: "3",
  L04: "4+G",
};

const FLOOR_INDICES: Record<string, number> = {
  L00: 0,
  L01: 1,
  L02: 2,
  L03: 3,
  L04: 4,
};

const EXTERIOR_PHOTOS: ExteriorPhoto[] = [
  { id: "001", label: "Kosi pogled JI", angle: "SE", image_url: "/api/mocire/media/exterior/001", width: 1920, height: 1080 },
  { id: "000", label: "Glavno pročelje (Jug)", angle: "S", image_url: "/api/mocire/media/exterior/000", width: 1920, height: 1080 },
  { id: "002", label: "Kosi pogled JZ", angle: "SW", image_url: "/api/mocire/media/exterior/002", width: 1920, height: 1080 },
  { id: "003", label: "Stražnje pročelje SZ", angle: "NW", image_url: "/api/mocire/media/exterior/003", width: 1920, height: 1080 },
  { id: "004", label: "Stražnje pročelje SI", angle: "NE", image_url: "/api/mocire/media/exterior/004", width: 1920, height: 1080 },
  { id: "005", label: "Prilaz i ulaz", angle: "S+", image_url: "/api/mocire/media/exterior/005", width: 1920, height: 1080 },
  { id: "006", label: "Ulazno stubište", angle: "UL", image_url: "/api/mocire/media/exterior/006", width: 1920, height: 1080 },
  { id: "007", label: "Prizemlje i parking", angle: "PR", image_url: "/api/mocire/media/exterior/007", width: 1920, height: 1080 },
];

type RawFloorsDoc = {
  project: string;
  building: string;
  floors: {
    floor_id: string;
    label: string;
    as_of: string;
    unit_ids: string[];
    plans: {
      image_id: string;
      variant: "main" | "gallery";
      width_px: number;
      height_px: number;
      viewBox: string;
      private_overlay: string;
    }[];
  }[];
};

type RawAptsDoc = {
  units: {
    unit_id: string;
    floor_id: string;
    source_ref: string;
    unit_type_source_label: string;
    status: string;
    status_as_of: string;
    listing_area_raw: string;
    listing_area_m2: number;
    price: number | null;
    orientation: string | null;
    sheet?: {
      source_url?: string;
      np_total_m2?: number;
      nkp_total_m2?: number;
      rooms?: RoomEntry[];
    };
  }[];
};

type RawCalibDoc = {
  px_per_m: number;
  estimation_flag: string;
  method: string;
  building_m: {
    width_x: number;
    depth_y: number;
    balcony_proj_y: number;
    total_height_z: number;
    hood_top_z: number;
    corridor_y: [number, number];
    core_x: [number, number];
  };
  floors: Record<string, { z0: number; z1: number; label: string }>;
  units: (UnitGeometry3D & {
    unit_id: string;
    has_balcony: boolean;
    has_loggia: boolean;
    has_terrace: boolean;
  })[];
};

function parsePolygonsFromSvg(svg: string): { unitId: string; points: string }[] {
  return [...svg.matchAll(/<polygon data-unit-id="(H [0-9]+\.[0-9]+)" points="([^"]+)"/g)].map(
    ([, unitId, points]) => ({ unitId, points }),
  );
}

function normalizeStatus(raw: string): AvailabilityStatus {
  if (raw === "Slobodno" || raw === "Rezervirano" || raw === "Prodano") return raw;
  return "Prodano";
}

function unitSlug(unitId: string): string {
  return unitId.replace(/\s+/g, "-");
}

export async function loadSelectorDataset(): Promise<SelectorDataset> {
  const cwd = process.cwd();
  const [floorsRaw, aptsRaw, calibRaw] = await Promise.all([
    readFile(join(cwd, "src/data/floors.json"), "utf8"),
    readFile(join(cwd, "src/data/apartments.json"), "utf8"),
    readFile(join(cwd, "assets/geometry/mocire-h-3d-calibration.json"), "utf8"),
  ]);

  const floorsDoc = JSON.parse(floorsRaw) as RawFloorsDoc;
  const aptsDoc = JSON.parse(aptsRaw) as RawAptsDoc;
  const calibDoc = JSON.parse(calibRaw) as RawCalibDoc;

  const calibById = new Map(calibDoc.units.map((u) => [u.unit_id, u]));
  const floorLabelById = new Map(floorsDoc.floors.map((f) => [f.floor_id, f.label]));

  const units: SelectorUnit[] = aptsDoc.units.map((u) => {
    const geom = calibById.get(u.unit_id);
    if (!geom) {
      throw new Error(`Missing 3D calibration for unit ${u.unit_id}`);
    }
    const rooms = u.sheet?.rooms ?? [];
    let exteriorArea = 0;
    let exteriorLabel: string | null = null;
    for (const r of rooms) {
      const lower = r.label.toLowerCase();
      if (
        lower.includes("balkon") ||
        lower.includes("lođa") ||
        lower.includes("loggia") ||
        lower.includes("terasa") ||
        lower.includes("vrt")
      ) {
        exteriorArea += r.np_m2;
        if (!exteriorLabel) {
          if (lower.includes("terasa") || lower.includes("vrt")) exteriorLabel = "Terasa/Vrt";
          else if (lower.includes("lođa") || lower.includes("loggia")) exteriorLabel = "Lođa";
          else exteriorLabel = "Balkon";
        }
      }
    }

    const slug = unitSlug(u.unit_id);
    return {
      unit_id: u.unit_id,
      slug,
      floor_id: u.floor_id,
      floor_label: floorLabelById.get(u.floor_id) ?? u.floor_id,
      floor_index: FLOOR_INDICES[u.floor_id] ?? 0,
      status: normalizeStatus(u.status),
      status_as_of: u.status_as_of.slice(0, 10),
      unit_type: u.unit_type_source_label,
      rooms_count: ROOM_COUNT_MAP[u.unit_type_source_label] ?? 2,
      listing_area_m2: u.listing_area_m2,
      listing_area_raw: u.listing_area_raw,
      np_total_m2: u.sheet?.np_total_m2 ?? null,
      nkp_total_m2: u.sheet?.nkp_total_m2 ?? null,
      exterior_area_m2: Math.round(exteriorArea * 100) / 100,
      exterior_label: exteriorLabel,
      has_balcony: geom.has_balcony,
      has_loggia: geom.has_loggia,
      has_terrace: geom.has_terrace,
      price: u.price ?? null,
      orientation: u.orientation ?? null,
      source_ref: u.source_ref,
      pdf_url: u.sheet?.source_url ?? null,
      inquiry_url: "https://www.sigma.hr/upit-za-stan/",
      unit_plan_url: `/api/mocire/media/unit/${slug}`,
      rooms,
      geometry3d: {
        primary_side: geom.primary_side,
        facades: geom.facades,
        has_south_balcony: geom.has_south_balcony,
        balcony_span_x: geom.balcony_span_x,
        building_bbox_m: geom.building_bbox_m,
        raw_bbox_m: geom.raw_bbox_m,
        polygon_m: geom.polygon_m,
      },
    };
  });

  // Sort canonically by floor_index then unit numeric suffix
  units.sort((a, b) => {
    if (a.floor_index !== b.floor_index) return a.floor_index - b.floor_index;
    const na = Number(a.unit_id.split(".")[1] ?? 0);
    const nb = Number(b.unit_id.split(".")[1] ?? 0);
    return na - nb;
  });

  const floors: SelectorFloor[] = await Promise.all(
    floorsDoc.floors.map(async (f) => {
      const fUnits = units.filter((u) => u.floor_id === f.floor_id);
      const band = calibDoc.floors[f.floor_id];
      const plans: FloorPlanDrawing[] = await Promise.all(
        f.plans.map(async (p) => {
          let polygons: { unitId: string; points: string }[] = [];
          try {
            const svg = await readFile(join(cwd, p.private_overlay), "utf8");
            polygons = parsePolygonsFromSvg(svg);
          } catch {
            polygons = [];
          }
          return {
            image_id: p.image_id,
            variant: p.variant,
            width_px: p.width_px,
            height_px: p.height_px,
            viewBox: p.viewBox,
            image_url: `/api/mocire/media/plan/${p.image_id}`,
            polygons,
          };
        }),
      );

      return {
        floor_id: f.floor_id,
        floor_index: FLOOR_INDICES[f.floor_id] ?? 0,
        label: f.label,
        short_label: SHORT_FLOOR_LABELS[f.floor_id] ?? f.floor_id,
        z0: band?.z0 ?? 0,
        z1: band?.z1 ?? 3,
        unit_ids: f.unit_ids,
        available_count: fUnits.filter((u) => u.status === "Slobodno").length,
        reserved_count: fUnits.filter((u) => u.status === "Rezervirano").length,
        sold_count: fUnits.filter((u) => u.status === "Prodano").length,
        plans,
      };
    }),
  );

  const asOfDate = floorsDoc.floors[0]?.as_of.slice(0, 10) ?? "2026-11-23";

  return {
    project: floorsDoc.project,
    building: "Zgrada H",
    location: "Zadar, Hrvatska",
    source_url: "https://www.sigma.hr/projekti/mocire-zadar-h/",
    as_of_date: asOfDate,
    model_url: "/models/mocire-h/mocire_h.glb?v=8",
    building_m: {
      ...calibDoc.building_m,
      px_per_m: calibDoc.px_per_m,
      estimation_flag: calibDoc.estimation_flag,
      method: calibDoc.method,
    },
    floors,
    units,
    exterior_photos: EXTERIOR_PHOTOS,
  };
}
