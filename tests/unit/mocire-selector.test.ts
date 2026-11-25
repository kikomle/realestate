import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSelectorDataset } from "@/lib/mocire/load-selector-data";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  filterUnits,
  STATUS_META,
} from "@/lib/mocire/status-colors";

const hasPrivateLocalData =
  existsSync(join(process.cwd(), "src/data/apartments.json")) &&
  existsSync(join(process.cwd(), "src/data/floors.json"));

describe("Močire Zadar H selector dataset & filters", () => {
  it("defines green, yellow, and red colors for all three availability states", () => {
    expect(STATUS_META.Slobodno.hex).toBe("#22c55e");
    expect(STATUS_META.Rezervirano.hex).toBe("#eab308");
    expect(STATUS_META.Prodano.hex).toBe("#ef4444");
  });

  it.skipIf(!hasPrivateLocalData)(
    "loads all 94 sourced Sigma units, 5 floors, 8 exterior photos, and 3D calibration",
    async () => {
    const dataset = await loadSelectorDataset();
    expect(dataset.units).toHaveLength(94);
    expect(dataset.floors).toHaveLength(5);
    expect(dataset.exterior_photos).toHaveLength(8);
    expect(dataset.building_m.width_x).toBeGreaterThan(60);
    expect(dataset.building_m.depth_y).toBeGreaterThan(15);

    const available = dataset.units.filter((u) => u.status === "Slobodno");
    const reserved = dataset.units.filter((u) => u.status === "Rezervirano");
    const sold = dataset.units.filter((u) => u.status === "Prodano");
    expect(available).toHaveLength(43);
    expect(reserved).toHaveLength(0);
    expect(sold).toHaveLength(51);

    // Never invent prices
    expect(dataset.units.every((u) => u.price === null)).toBe(true);
    // Every unit has valid 3D facade geometry
    expect(dataset.units.every((u) => u.geometry3d.facades.length >= 1)).toBe(true);
    // Total SVG polygons across all 6 plans = 115
    const polyTotal = dataset.floors
      .flatMap((f) => f.plans)
      .reduce((acc, p) => acc + p.polygons.length, 0);
    expect(polyTotal).toBe(115);
    },
  );

  it.skipIf(!hasPrivateLocalData)(
    "filters units accurately across status, floor, rooms, search, and favorites",
    async () => {
    const dataset = await loadSelectorDataset();
    const favs = new Set(["H 2.1", "H 4.1"]);

    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(filterUnits(dataset.units, DEFAULT_FILTERS, favs)).toHaveLength(94);

    const availL02 = filterUnits(
      dataset.units,
      { ...DEFAULT_FILTERS, floorId: "L02", onlyAvailable: true },
      favs,
    );
    expect(availL02.length).toBeGreaterThan(0);
    expect(availL02.every((u) => u.floor_id === "L02" && u.status === "Slobodno")).toBe(true);

    const favOnly = filterUnits(
      dataset.units,
      { ...DEFAULT_FILTERS, onlyFavorites: true },
      favs,
    );
    expect(favOnly.map((u) => u.unit_id).sort()).toEqual(["H 2.1", "H 4.1"]);

    const yellowOnly = filterUnits(
      dataset.units,
      { ...DEFAULT_FILTERS, status: "Rezervirano" },
      favs,
    );
    expect(yellowOnly).toHaveLength(0);
    },
  );
});
