export const exteriorPreviewPath = "/exterior-preview";
export const planProofPath = `${exteriorPreviewPath}/plans`;
export const privatePlanReviewUrl = "http://127.0.0.1:4175/plan-review";
const reviewViews = {
  "review-facade": { href: `${privatePlanReviewUrl}?view=facade`, label: "Pročelje", back: "Natrag na pročelje" },
  "review-arrival": { href: privatePlanReviewUrl, label: "Prilaz", back: "Natrag na prilaz" },
} as const;

export type PlanEntry = "overview" | keyof typeof reviewViews;

export function readPlanEntry(value: string | string[] | undefined): PlanEntry | undefined {
  if (value === "review-overview") return "review-arrival"; // Older private bookmarks.
  if (value === "overview" || value === "review-facade" || value === "review-arrival") {
    return value;
  }
}

export function exteriorPlanReturn(floorId: string, entry: PlanEntry | undefined) {
  if (entry && entry !== "overview") {
    const view = reviewViews[entry];
    return { ...view, brandHref: view.href };
  }
  return entry === "overview"
    ? { href: exteriorPreviewPath, brandHref: exteriorPreviewPath, label: "Prilaz", back: "Natrag na prilaz" }
    : { href: `${exteriorPreviewPath}?floor=${encodeURIComponent(floorId)}`, brandHref: exteriorPreviewPath,
        label: "Pročelje", back: "Natrag na pročelje" };
}

export function planProofHref(floorId: string, variant = "main", unitId?: string, entry?: PlanEntry) {
  const query = new URLSearchParams({ floor: floorId });
  if (variant !== "main") query.set("plan", variant);
  if (unitId) query.set("unit", unitId);
  if (entry) query.set("via", entry);
  return `${planProofPath}?${query}`;
}
