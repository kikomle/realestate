import { clamp, validFrame, type CameraFrame, type CameraPosition } from "./camera";

export const PLAN_HOME: CameraPosition = { x: 0, y: 0, scale: 1 };
export const PLAN_MAX_ZOOM = 4;

export function fitInside(image: CameraFrame, viewport: CameraFrame): CameraFrame {
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

export function keepPlanInFrame(pose: CameraPosition, image: CameraFrame, viewport: CameraFrame, inset = 0): CameraPosition {
  const padded = { width: viewport.width - 2 * inset, height: viewport.height - 2 * inset };
  if (!validFrame(padded)) return { ...PLAN_HOME };
  const fit = fitInside(image, padded);
  const scale = clamp(pose.scale, 1, PLAN_MAX_ZOOM);
  const xLimit = Math.max(0, (fit.width * scale - viewport.width) / 2);
  const yLimit = Math.max(0, (fit.height * scale - viewport.height) / 2);
  return {
    x: xLimit ? clamp(pose.x, -xLimit, xLimit) : 0,
    y: yLimit ? clamp(pose.y, -yLimit, yLimit) : 0,
    scale,
  };
}

/** Pointer and pan offsets are measured from the centre of the fitted sheet. */
export function zoomPlanAt(pose: CameraPosition, scale: number, anchor = { x: 0, y: 0 }): CameraPosition {
  const next = clamp(scale, 1, PLAN_MAX_ZOOM);
  const ratio = next / pose.scale;
  return { x: anchor.x + (pose.x - anchor.x) * ratio, y: anchor.y + (pose.y - anchor.y) * ratio, scale: next };
}

/** Local floor-plan pixels → CSS transform; no change to the source image or registration. */
export function focusFootprint(
  points: string, native: CameraFrame, displayed: CameraFrame, viewport: CameraFrame,
): CameraPosition | null {
  if (![native, displayed, viewport].every(validFrame)) return null;
  const vertices = points.trim().split(/\s+/).map(pair => pair.split(",").map(Number));
  if (vertices.length < 3 || vertices.some(([x, y]) =>
    !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > native.width || y < 0 || y > native.height)) return null;
  const xs = vertices.map(([x]) => x * displayed.width / native.width);
  const ys = vertices.map(([, y]) => y * displayed.height / native.height);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  if (right <= left || bottom <= top) return null;
  const width = right - left;
  const height = bottom - top;
  const paddedFit = Math.min(viewport.width * 0.76 / width, viewport.height * 0.88 / height);
  // Preserve the resting scale unless the aperture would crop the footprint.
  // In native-size mode on a phone this can be a pullback rather than a push-in.
  const scale = width > viewport.width || height > viewport.height ? paddedFit : clamp(paddedFit, 1, 5);
  return {
    x: (viewport.width - (left + right) * scale) / 2,
    y: (viewport.height - (top + bottom) * scale) / 2,
    scale,
  };
}
