export type ExteriorView = "arrival" | "facade";

export type ExteriorAddress = {
  view: ExteriorView;
  floorId: string | null;
  invalidFloor: boolean;
};

export type FloorPlanRef = {
  imageId: string;
  variant: string;
  sha256: string;
};

export type ExteriorFloor = {
  id: string;
  label: string;
  plans: readonly FloorPlanRef[];
};

type Point = readonly [number, number];
type ApprovedRegistration = {
  floorId: string;
  viewId: string;
  sourceSha256: string;
  polygons: readonly (readonly Point[])[];
  focus: Point;
  zoom: number;
};
type SettledEndpoint = {
  viewId: string;
  x: number;
  y: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
};
type HandoffIdentity = {
  floorId: string;
  label: string;
  viewId: string;
  planRefs: readonly FloorPlanRef[];
  url: string;
};
type ReadyHandoff = HandoffIdentity & {
  status: "ready";
  registration: ApprovedRegistration;
  endpoint: SettledEndpoint;
};
type FloorHandoff = ReadyHandoff | (HandoffIdentity & {
  status: "blocked";
  reason: "NO_VERIFIED_EXTERIOR_REGISTRATION" | "FOCUS_NOT_SETTLED";
  registration: ApprovedRegistration | null;
  endpoint: null;
});

export function readExteriorAddress(
  query: URLSearchParams,
  knownFloors: ReadonlySet<string>,
): ExteriorAddress {
  const floors = query.getAll("floor");
  const floorId = floors.length === 1 && knownFloors.has(floors[0]) ? floors[0] : null;
  return {
    view: floorId || query.get("view") === "facade" ? "facade" : "arrival",
    floorId,
    invalidFloor: floors.length > 0 && floorId === null,
  };
}

export function writeExteriorAddress(url: URL, view: ExteriorView, floorId: string | null) {
  const query = new URLSearchParams(url.search);
  query.delete("floor");
  query.delete("view");
  if (floorId) query.set("floor", floorId);
  else if (view === "facade") query.set("view", view);
  const search = query.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export function getFloorHandoff(
  floor: ExteriorFloor,
  viewId: string,
  registration?: ApprovedRegistration,
  settled?: SettledEndpoint & { floorId: string; sourceSha256: string },
): FloorHandoff {
  const identity = {
    floorId: floor.id,
    label: floor.label,
    viewId,
    planRefs: floor.plans,
    url: `/exterior-preview?floor=${encodeURIComponent(floor.id)}`,
  };
  if (!registration || registration.floorId !== floor.id || registration.viewId !== viewId) {
    return { ...identity, status: "blocked", reason: "NO_VERIFIED_EXTERIOR_REGISTRATION",
      registration: null, endpoint: null };
  }
  if (!settled || settled.floorId !== floor.id || settled.viewId !== viewId ||
      settled.sourceSha256 !== registration.sourceSha256) {
    return { ...identity, status: "blocked", reason: "FOCUS_NOT_SETTLED", registration, endpoint: null };
  }
  const { x, y, scale, viewportWidth, viewportHeight } = settled;
  return {
    ...identity, status: "ready", registration,
    endpoint: { viewId, x, y, scale, viewportWidth, viewportHeight },
  };
}

/** Stage 4 supplies the opening action; Stage 3 never mounts or routes to a plan. */
export function openSelectedFloorPlan(handoff: FloorHandoff | null, open: (data: ReadyHandoff) => void) {
  if (handoff?.status !== "ready") return false;
  open(handoff);
  return true;
}
