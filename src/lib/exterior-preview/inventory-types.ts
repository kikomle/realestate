import type { ApartmentDetails } from "./apartment-detail";

// Compile-time shapes only. The actual source snapshots stay in local files.
export type FloorPlanRecord = {
  image_id: string;
  variant: string;
  sha256: string;
  width_px: number;
  height_px: number;
  viewBox: string;
  registered_units: number;
  private_plan: string;
  optimized_sha256: string;
  private_overlay: string;
  overlay_sha256: string;
};

export type FloorRecord = {
  floor_id: string;
  label: string;
  unit_ids: string[];
  plans: FloorPlanRecord[];
};

export type FloorInventory = { floors: FloorRecord[] };

type DrawingReference = { source_url: string; original_name: string; sha256: string };

export type UnitRecord = {
  unit_id: string;
  floor_id: string;
  source_ref: string;
  unit_type_source_label: string;
  listing_area_raw: string;
  status: string;
  status_as_of: string;
  flags: string[];
  detail_page: { facts: { Status: string }; np_total_m2: number };
  unit_drawing: DrawingReference;
  sheet: DrawingReference & NonNullable<ApartmentDetails["sheet"]>;
};

export type ApartmentInventory = { units: UnitRecord[] };
