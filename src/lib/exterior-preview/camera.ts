import type { ExteriorBand, ExteriorView } from "./types"

export type CameraFrame = { width: number; height: number }
export type CameraPosition = { x: number; y: number; scale: number }

export const MAX_COVER_ZOOM = 1.65
export const CAMERA_DURATION = 0.3
export const VIEW_TRANSITION_DURATION = 1.14
export const CROSSFADE_DURATION = VIEW_TRANSITION_DURATION

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function validFrame(frame: CameraFrame): boolean {
  return Number.isFinite(frame.width) && Number.isFinite(frame.height) &&
    frame.width > 0 && frame.height > 0
}

export function cameraLimits(image: CameraFrame, viewport: CameraFrame) {
  const cover = Math.max(viewport.width / image.width, viewport.height / image.height)
  // Avoid excessive enlargement of a small derivative; never undershoot cover.
  return { cover, max: Math.max(cover, Math.min(1.12, cover * MAX_COVER_ZOOM)) }
}

export function constrainCamera(
  next: CameraPosition,
  image: CameraFrame,
  viewport: CameraFrame,
): CameraPosition {
  const { cover, max } = cameraLimits(image, viewport)
  const scale = clamp(Number.isFinite(next.scale) ? next.scale : cover, cover, max)
  return {
    scale,
    x: clamp(Number.isFinite(next.x) ? next.x : 0, Math.min(0, viewport.width - image.width * scale), 0),
    y: clamp(Number.isFinite(next.y) ? next.y : 0, Math.min(0, viewport.height - image.height * scale), 0),
  }
}

/** A normalized point projected to a viewport anchor, never a metric camera. */
export function cameraTarget(
  image: CameraFrame,
  viewport: CameraFrame,
  focus: readonly [number, number] = [0.5, 0.5],
  zoom = 1,
  anchor: readonly [number, number] = [0.5, 0.5],
): CameraPosition {
  const { cover, max } = cameraLimits(image, viewport)
  const scale = clamp(cover * (Number.isFinite(zoom) ? zoom : 1), cover, max)
  return constrainCamera({
    scale,
    x: viewport.width * anchor[0] - focus[0] * image.width * scale,
    y: viewport.height * anchor[1] - focus[1] * image.height * scale,
  }, image, viewport)
}

/**
 * Art-direction of the two reviewed exterior stills, not floor geometry.
 * Arrival keeps the oblique roof/corner in the portrait crop; facade stays near
 * cover with only a gentle desktop push-in. No default implies a floor focus.
 * Reset and initial framing deliberately share this function.
 */
export function defaultCameraTarget(
  image: CameraFrame,
  viewport: CameraFrame,
  view: ExteriorView,
): CameraPosition {
  const portrait = viewport.width < 680 && viewport.width < viewport.height
  if (view === "arrival") {
    return cameraTarget(image, viewport,
      [portrait ? 0.675 : 0.526, 0.426], 1,
      [0.5, portrait ? 0.48 : 0.5])
  }
  return cameraTarget(image, viewport, [0.5125, 0.3926], portrait ? 1 : 1.025,
    [portrait ? 0.5 : 0.47, portrait ? 0.41 : 0.44])
}

function normalizedPoint(point: readonly [number, number]): boolean {
  return point.length === 2 && point.every(value => Number.isFinite(value) && value >= 0 && value <= 1)
}

/** Fail closed; do not repair, clip, synthesize or authorize supplied geometry. */
export function validExteriorBands(bands: readonly ExteriorBand[]): ExteriorBand[] {
  const counts = new Map<string, number>()
  for (const band of bands) counts.set(band.id, (counts.get(band.id) ?? 0) + 1)
  return bands.filter(band => {
    if (!band.id.trim() || !band.label.trim() || counts.get(band.id) !== 1 ||
      !normalizedPoint(band.focus) || !Number.isFinite(band.zoom) || band.zoom <= 0 ||
      band.polygons.length === 0) return false
    return band.polygons.every(ring => {
      if (ring.length < 3 || !ring.every(normalizedPoint)) return false
      let area = 0
      for (let index = 0; index < ring.length; index++) {
        const next = ring[(index + 1) % ring.length]
        area += ring[index][0] * next[1] - next[0] * ring[index][1]
      }
      return Math.abs(area) > Number.EPSILON
    })
  })
}
