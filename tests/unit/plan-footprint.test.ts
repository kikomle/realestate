import { describe, expect, it } from "vitest";
import { polygonArea, formatPixelArea } from "@/lib/exterior-preview/plan-footprint";

describe("plan footprint", () => {
  it("computes shoelace area for a triangle", () => {
    expect(polygonArea("0,0 10,0 0,10")).toBe(50);
  });
  it("is invariant to vertex order", () => {
    expect(polygonArea("0,0 0,10 10,0")).toBe(50);
  });
  it("returns null for degenerate input", () => {
    expect(polygonArea("0,0 1,1")).toBeNull();
    expect(polygonArea("")).toBeNull();
    expect(polygonArea("a,b")).toBeNull();
  });
  it("formats pixel area", () => {
    expect(formatPixelArea(1234.6)).toBe("1.235");
  });
});