import { describe, expect, it } from "vitest";
import {
  getFloorHandoff,
  openSelectedFloorPlan,
  readExteriorAddress,
  writeExteriorAddress,
} from "../../src/components/exterior-preview/selection";

const plan = { imageId: "L02", variant: "main", sha256: "plan-hash" };
const floor = { id: "L02", label: "Etaža 2", plans: [plan] };
const known = new Set([floor.id]);

describe("the private exterior address", () => {
  it.each([
    ["", "arrival", null, false],
    ["view=facade", "facade", null, false],
    ["floor=L02", "facade", "L02", false],
    ["floor=L02&view=arrival", "facade", "L02", false],
    ["floor=", "arrival", null, true],
    ["floor=UNKNOWN", "arrival", null, true],
    ["floor=L02&floor=L02", "arrival", null, true],
  ])("resolves %s without guessing a floor", (query, view, floorId, invalidFloor) => {
    expect(readExteriorAddress(new URLSearchParams(query), known)).toEqual({
      view, floorId, invalidFloor,
    });
  });

  it("leaves unrelated parameters and the fragment alone", () => {
    const url = new URL("http://127.0.0.1/exterior-preview?view=facade&lang=hr#top");
    expect(writeExteriorAddress(url, "facade", "L02")).toBe("/exterior-preview?lang=hr&floor=L02#top");
    expect(writeExteriorAddress(url, "arrival", null)).toBe("/exterior-preview?lang=hr#top");
  });
});

describe("the floor plan handoff", () => {
  it("keeps the real floor and plan identity with no fabricated camera endpoint", () => {
    expect(getFloorHandoff(floor, "Mocire_H-Zadar_000")).toEqual({
      floorId: "L02",
      label: "Etaža 2",
      viewId: "Mocire_H-Zadar_000",
      planRefs: [plan],
      url: "/exterior-preview?floor=L02",
      status: "blocked",
      reason: "NO_VERIFIED_EXTERIOR_REGISTRATION",
      registration: null,
      endpoint: null,
    });
  });

  it("does not open a plan for an unverified or stale visual endpoint", () => {
    const viewId = "Mocire_H-Zadar_000";
    const registration = {
      floorId: floor.id, viewId, sourceSha256: "render-hash",
      polygons: [[[0.25, 0.4], [0.65, 0.4], [0.65, 0.5]]], focus: [0.5, 0.42], zoom: 1.2,
    } as const;
    const endpoint = {
      floorId: floor.id, viewId, sourceSha256: registration.sourceSha256,
      x: -80, y: -20, scale: 1.2, viewportWidth: 1440, viewportHeight: 900,
    };
    const open = () => { throw new Error("Opened an unverified plan"); };
    expect(openSelectedFloorPlan(getFloorHandoff(floor, viewId), open)).toBe(false);
    const stale = getFloorHandoff(floor, viewId, registration, { ...endpoint, floorId: "L04" });
    expect(stale).toMatchObject({ status: "blocked", endpoint: null, reason: "FOCUS_NOT_SETTLED" });
    expect(openSelectedFloorPlan(stale, open)).toBe(false);

    const ready = getFloorHandoff(floor, viewId, registration, endpoint);
    expect(openSelectedFloorPlan(ready, data => {
      expect(data.endpoint).toMatchObject({ viewId, scale: 1.2, viewportHeight: 900 });
      expect(data.planRefs).toEqual([plan]);
    })).toBe(true);
  });
});
