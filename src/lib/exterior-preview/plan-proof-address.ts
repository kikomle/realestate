export const exteriorPreviewPath = "/exterior-preview";
export const planProofPath = `${exteriorPreviewPath}/plans`;

export function planProofHref(floorId: string, variant = "main", unitId?: string) {
  const query = new URLSearchParams({ floor: floorId });
  if (variant !== "main") query.set("plan", variant);
  if (unitId) query.set("unit", unitId);
  return `${planProofPath}?${query}`;
}
