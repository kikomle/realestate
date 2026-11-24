export type Vec3 = [number, number, number]

export type Bounds = {
  min: Vec3
  max: Vec3
}

export function boundsCenter(bounds: Bounds): Vec3 {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ]
}

export function boundsRadius(bounds: Bounds): number {
  const dx = bounds.max[0] - bounds.min[0]
  const dy = bounds.max[1] - bounds.min[1]
  const dz = bounds.max[2] - bounds.min[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / 2
}

export function computeFlyTarget(
  bounds: Bounds,
  fovDeg: number,
  viewDir: Vec3 = [0.6, 0.45, 0.66],
  padding = 1.4,
): { position: Vec3; target: Vec3 } {
  const center = boundsCenter(bounds)
  const radius = Math.max(boundsRadius(bounds), 0.5)
  const distance = (radius * padding) / Math.sin((fovDeg * Math.PI) / 360)
  const len = Math.hypot(viewDir[0], viewDir[1], viewDir[2]) || 1
  const d: Vec3 = [viewDir[0] / len, viewDir[1] / len, viewDir[2] / len]
  return {
    target: center,
    position: [
      center[0] + d[0] * distance,
      center[1] + d[1] * distance,
      center[2] + d[2] * distance,
    ],
  }
}

export const FLY_DURATION_S = 1.2
export const FLY_EASE = "power2.inOut"

export function transitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : FLY_DURATION_S
}
