export type AvailabilityStatus = "Slobodno" | "Rezervirano" | "Prodano";

export type RoomEntry = {
  number: string;
  label: string;
  np_m2: number;
  coefficient: number;
  nkp_m2: number;
};

export type UnitGeometry3D = {
  primary_side: "south" | "north";
  facades: ("south" | "north" | "west" | "east")[];
  has_south_balcony: boolean;
  balcony_span_x: [number, number] | null;
  building_bbox_m: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    z0: number;
    z1: number;
  };
  raw_bbox_m: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
  polygon_m: [number, number][];
};

export type SelectorUnit = {
  unit_id: string;
  slug: string;
  floor_id: string;
  floor_label: string;
  floor_index: number;
  status: AvailabilityStatus;
  status_as_of: string;
  unit_type: string;
  rooms_count: number;
  listing_area_m2: number;
  listing_area_raw: string;
  np_total_m2: number | null;
  nkp_total_m2: number | null;
  exterior_area_m2: number;
  exterior_label: string | null;
  has_balcony: boolean;
  has_loggia: boolean;
  has_terrace: boolean;
  price: number | null;
  orientation: string | null;
  source_ref: string;
  pdf_url: string | null;
  inquiry_url: string;
  unit_plan_url: string | null;
  rooms: RoomEntry[];
  geometry3d: UnitGeometry3D;
};

export type FloorPlanDrawing = {
  image_id: string;
  variant: "main" | "gallery";
  width_px: number;
  height_px: number;
  viewBox: string;
  image_url: string;
  polygons: { unitId: string; points: string }[];
};

export type SelectorFloor = {
  floor_id: string;
  floor_index: number;
  label: string;
  short_label: string;
  z0: number;
  z1: number;
  unit_ids: string[];
  available_count: number;
  reserved_count: number;
  sold_count: number;
  plans: FloorPlanDrawing[];
};

export type ExteriorPhoto = {
  id: string;
  label: string;
  angle: string;
  image_url: string;
  width: number;
  height: number;
};

export type BuildingCalibration = {
  width_x: number;
  depth_y: number;
  balcony_proj_y: number;
  total_height_z: number;
  hood_top_z: number;
  corridor_y: [number, number];
  core_x: [number, number];
  px_per_m: number;
  estimation_flag: string;
  method: string;
};

export type SelectorDataset = {
  project: string;
  building: string;
  location: string;
  source_url: string;
  as_of_date: string;
  model_url: string;
  building_m: BuildingCalibration;
  floors: SelectorFloor[];
  units: SelectorUnit[];
  exterior_photos: ExteriorPhoto[];
};
