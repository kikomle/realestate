import type { AvailabilityStatus, SelectorUnit } from "./types";

export const STATUS_META: Record<
  AvailabilityStatus,
  {
    label: string;
    english: string;
    hex: string;
    fillRgba: string;
    hoverRgba: string;
    strokeHex: string;
    badgeBg: string;
    badgeText: string;
    dotClass: string;
  }
> = {
  Slobodno: {
    label: "Slobodno",
    english: "Available",
    hex: "#22c55e",
    fillRgba: "rgba(34, 197, 94, 0.34)",
    hoverRgba: "rgba(34, 197, 94, 0.68)",
    strokeHex: "#4ade80",
    badgeBg: "bg-emerald-500/20 border-emerald-400/40",
    badgeText: "text-emerald-200",
    dotClass: "bg-emerald-400",
  },
  Rezervirano: {
    label: "Rezervirano",
    english: "Reserved",
    hex: "#eab308",
    fillRgba: "rgba(234, 179, 8, 0.38)",
    hoverRgba: "rgba(234, 179, 8, 0.72)",
    strokeHex: "#facc15",
    badgeBg: "bg-amber-500/20 border-amber-400/40",
    badgeText: "text-amber-200",
    dotClass: "bg-amber-400",
  },
  Prodano: {
    label: "Prodano",
    english: "Sold",
    hex: "#ef4444",
    fillRgba: "rgba(239, 68, 68, 0.34)",
    hoverRgba: "rgba(239, 68, 68, 0.68)",
    strokeHex: "#f87171",
    badgeBg: "bg-rose-500/20 border-rose-400/40",
    badgeText: "text-rose-200",
    dotClass: "bg-rose-400",
  },
};

export type FilterState = {
  search: string;
  floorId: string; // "ALL" or "L00".."L04"
  status: "ALL" | AvailabilityStatus;
  rooms: number | null; // null = all, or 2..5
  minArea: number;
  maxArea: number;
  onlyBalcony: boolean;
  onlyLoggia: boolean;
  onlyTerrace: boolean;
  onlyAvailable: boolean;
  onlyFavorites: boolean;
};

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  floorId: "ALL",
  status: "ALL",
  rooms: null,
  minArea: 35,
  maxArea: 120,
  onlyBalcony: false,
  onlyLoggia: false,
  onlyTerrace: false,
  onlyAvailable: false,
  onlyFavorites: false,
};

export function countActiveFilters(f: FilterState): number {
  let count = 0;
  if (f.search.trim()) count++;
  if (f.floorId !== "ALL") count++;
  if (f.status !== "ALL") count++;
  if (f.rooms !== null) count++;
  if (f.minArea > DEFAULT_FILTERS.minArea || f.maxArea < DEFAULT_FILTERS.maxArea) count++;
  if (f.onlyBalcony) count++;
  if (f.onlyLoggia) count++;
  if (f.onlyTerrace) count++;
  if (f.onlyAvailable) count++;
  if (f.onlyFavorites) count++;
  return count;
}

export function filterUnits(
  units: readonly SelectorUnit[],
  f: FilterState,
  favorites: ReadonlySet<string>,
): SelectorUnit[] {
  const q = f.search.trim().toLowerCase();
  return units.filter((u) => {
    if (f.floorId !== "ALL" && u.floor_id !== f.floorId) return false;
    if (f.status !== "ALL" && u.status !== f.status) return false;
    if (f.onlyAvailable && u.status !== "Slobodno") return false;
    if (f.rooms !== null && u.rooms_count !== f.rooms) return false;
    if (u.listing_area_m2 < f.minArea || u.listing_area_m2 > f.maxArea) return false;
    if (f.onlyBalcony && !u.has_balcony) return false;
    if (f.onlyLoggia && !u.has_loggia) return false;
    if (f.onlyTerrace && !u.has_terrace) return false;
    if (f.onlyFavorites && !favorites.has(u.unit_id)) return false;
    if (q) {
      const hay = `${u.unit_id} ${u.floor_label} ${u.unit_type} ${u.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function formatArea(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return "—";
  return val.toFixed(2).replace(".", ",");
}
