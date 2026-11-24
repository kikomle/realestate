import { describe, expect, it } from "vitest"
import {
  boundsCenter,
  boundsRadius,
  computeFlyTarget,
  FLY_DURATION_S,
  FLY_EASE,
  transitionDuration,
} from "@/lib/viewer/camera"

describe("camera math", () => {
  const box = { min: [0, 0, 0] as const, max: [2, 4, 6] as const }

  it("computes the bounds centre", () => {
    expect(boundsCenter({ min: [...box.min], max: [...box.max] })).toEqual([1, 2, 3])
  })

  it("computes the bounding-sphere radius", () => {
    expect(boundsRadius({ min: [...box.min], max: [...box.max] })).toBeCloseTo(Math.sqrt(4 + 16 + 36) / 2, 10)
  })

  it("targets the bounds centre and places the camera along the view direction", () => {
    const { target, position } = computeFlyTarget({ min: [...box.min], max: [...box.max] }, 35, [0, 0, 1])
    expect(target).toEqual([1, 2, 3])
    expect(position[0]).toBeCloseTo(1, 10)
    expect(position[1]).toBeCloseTo(2, 10)
    expect(position[2]).toBeGreaterThan(3)
  })

  it("keeps the whole bounding sphere inside the field of view", () => {
    const bounds = { min: [...box.min], max: [...box.max] } as const
    const fov = 35
    const { position, target } = computeFlyTarget({ min: [...bounds.min], max: [...bounds.max] }, fov)
    const dist = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])
    const r = boundsRadius({ min: [...bounds.min], max: [...bounds.max] })
    const halfFov = (fov * Math.PI) / 360
    expect(dist * Math.sin(halfFov)).toBeGreaterThanOrEqual(r)
  })

  it("never places the camera on the target for degenerate bounds", () => {
    const { position, target } = computeFlyTarget({ min: [1, 1, 1], max: [1, 1, 1] }, 35)
    expect(Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])).toBeGreaterThan(0)
  })

  it("uses the agreed 1.2 s power2.inOut transition", () => {
    expect(FLY_DURATION_S).toBe(1.2)
    expect(FLY_EASE).toBe("power2.inOut")
  })
})

describe("transitionDuration", () => {
  it("is 1.2 s normally and 0 with reduced motion", () => {
    expect(transitionDuration(false)).toBe(1.2)
    expect(transitionDuration(true)).toBe(0)
  })
})
