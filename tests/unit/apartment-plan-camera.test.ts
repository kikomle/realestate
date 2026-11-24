import { describe, expect, it } from "vitest";
import { fitInside, focusFootprint, keepPlanInFrame, zoomPlanAt } from "@/lib/exterior-preview/apartment-plan-camera";

describe("apartment plan framing", () => {
  const frame = { width: 800, height: 500 };
  const plan = { width: 600, height: 1000 };

  it("fits the whole drawing and constrains pan to actual drawing pixels", () => {
    expect(fitInside(plan, frame)).toEqual({ width: 300, height: 500 });
    expect(keepPlanInFrame({ x: 900, y: -900, scale: 2 }, plan, frame))
      .toEqual({ x: 0, y: -250, scale: 2 });
    expect(keepPlanInFrame({ x: 300, y: 900, scale: 9 }, plan, frame))
      .toEqual({ x: 200, y: 750, scale: 4 });
    expect(keepPlanInFrame({ x: 90, y: -50, scale: 0.3 }, plan, frame))
      .toEqual({ x: 0, y: 0, scale: 1 });
    expect(keepPlanInFrame({ x: 0, y: 900, scale: 2 }, plan, frame, 12))
      .toEqual({ x: 0, y: 226, scale: 2 });
  });

  it("zooms around the pointer relative to the centre of the canvas", () => {
    expect(zoomPlanAt({ x: 30, y: -40, scale: 2 }, 3, { x: -100, y: 160 }))
      .toEqual({ x: 95, y: -140, scale: 3 });
  });

  it("frames an edge footprint from registered image coordinates without clipping or guessing", () => {
    const points = "830,200 980,200 980,460 830,460";
    const target = focusFootprint(points, { width: 1000, height: 500 }, { width: 500, height: 250 }, frame);
    expect(target?.scale).toBeGreaterThan(1);
    expect(target!.x + (830 + 980) / 4 * target!.scale).toBeCloseTo(frame.width / 2);
    expect(target!.y + (200 + 460) / 4 * target!.scale).toBeCloseTo(frame.height / 2);
    expect(focusFootprint("1,2 2,3 3,600", { width: 1000, height: 500 }, frame, frame)).toBeNull();
    expect(focusFootprint("1,2 1,3 1,4", { width: 1000, height: 500 }, frame, frame)).toBeNull();
  });

  it("pulls back to fit a footprint wider than the native-size mobile aperture", () => {
    const drawing = { width: 1920, height: 700 };
    const aperture = { width: 360, height: 700 };
    const target = focusFootprint("700,120 1141,120 1141,650 700,650", drawing, drawing, aperture)!;
    expect(target.scale).toBeLessThan(1);
    expect(441 * target.scale).toBeCloseTo(360 * 0.76);
    expect(target.x + (700 + 1141) / 2 * target.scale).toBeCloseTo(aperture.width / 2);
  });

  it("does not pull back when only the soft framing margin is exceeded", () => {
    const drawing = { width: 960, height: 480 };
    expect(focusFootprint("10,20 350,20 350,200 10,200", drawing, drawing, { width: 360, height: 480 })?.scale)
      .toBe(1);
  });
});
