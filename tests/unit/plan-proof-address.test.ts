import { describe, expect, it } from "vitest";
import { exteriorPlanReturn, planProofHref, readPlanEntry } from "@/lib/exterior-preview/plan-proof-address";

describe("private floor plan navigation", () => {
  it("returns to the view that opened the plan", () => {
    expect(exteriorPlanReturn("L01", "overview").href).toBe("/exterior-preview");
    expect(exteriorPlanReturn("L01", "review-facade").href).toBe("http://127.0.0.1:4175/plan-review?view=facade");
    expect(exteriorPlanReturn("L01", "review-arrival")).toMatchObject({
      href: "http://127.0.0.1:4175/plan-review", back: "Natrag na prilaz",
    });
    expect(exteriorPlanReturn("L01", undefined).href).toBe("/exterior-preview?floor=L01");
  });

  it("preserves the return view when selecting an apartment on the gallery", () => {
    expect(planProofHref("L04", "gallery", "H 4.5", "review-arrival"))
      .toBe("/exterior-preview/plans?floor=L04&plan=gallery&unit=H+4.5&via=review-arrival");
  });

  it("accepts known views only, never a URL or repeated origin", () => {
    expect(readPlanEntry("review-facade")).toBe("review-facade");
    expect(readPlanEntry("review-overview")).toBe("review-arrival");
    expect(readPlanEntry("https://example.com/")).toBeUndefined();
    expect(readPlanEntry(["review-facade", "review-overview"])).toBeUndefined();
  });
});
