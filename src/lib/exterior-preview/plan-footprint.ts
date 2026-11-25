// Image-space measurements only. These are polygon areas in source-image pixels and
// are never converted into metres, advertised areas or any real-world dimension.
export function polygonArea(points: string): number | null {
  const vertices = points
    .trim()
    .split(/\s+/)
    .map(pair => pair.split(",").map(Number));
  if (vertices.length < 3 || vertices.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return null;
  }
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % vertices.length];
    sum += x1 * y2 - x2 * y1;
  }
  const area = Math.abs(sum) / 2;
  return Number.isFinite(area) && area > 0 ? area : null;
}

export function formatPixelArea(value: number): string {
  return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 0 }).format(Math.round(value));
}