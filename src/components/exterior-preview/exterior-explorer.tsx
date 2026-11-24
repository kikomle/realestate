"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { planProofHref } from "@/lib/exterior-preview/plan-proof-address";
import { ExplorerShell } from "./explorer-shell";
import {
  ExteriorViewport,
  type ExteriorBand,
  type ExteriorImage,
  type ExteriorViewportHandle,
} from "./exterior-viewport";
import {
  getFloorHandoff,
  readExteriorAddress,
  writeExteriorAddress,
  type ExteriorAddress,
  type ExteriorFloor,
  type ExteriorView,
} from "./selection";

// The old registration proof contains hand-estimated bands. Do not load them here.
const verifiedBands: readonly ExteriorBand[] = [];

export function ExteriorExplorer({
  images,
  floors,
  initial,
}: {
  images: Record<ExteriorView, ExteriorImage>;
  floors: readonly ExteriorFloor[];
  initial: ExteriorAddress;
}) {
  const viewport = useRef<ExteriorViewportHandle>(null);
  const [address, setAddress] = useState(initial);
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);
  const knownFloors = useMemo(() => new Set(floors.map(floor => floor.id)), [floors]);
  const floorControls = useMemo(() => floors.map(({ id, label }) => ({
    id, label, mapped: verifiedBands.some(band => band.id === id),
  })), [floors]);

  useEffect(() => {
    function restoreAddress() {
      setAddress(readExteriorAddress(new URLSearchParams(window.location.search), knownFloors));
      setHoveredFloorId(null);
    }
    window.addEventListener("popstate", restoreAddress);
    return () => window.removeEventListener("popstate", restoreAddress);
  }, [knownFloors]);

  const navigate = useCallback((view: ExteriorView, floorId: string | null = null) => {
    const url = new URL(window.location.href);
    const path = writeExteriorAddress(url, view, floorId);
    setHoveredFloorId(null);
    if (`${url.pathname}${url.search}${url.hash}` === path) return;
    window.history.pushState(null, "", path);
    setAddress({ view, floorId, invalidFloor: false });
  }, []);

  const selectFloor = useCallback((id: string) => {
    if (!knownFloors.has(id)) return;
    navigate("facade", id);
  }, [knownFloors, navigate]);

  const onFloorHover = useCallback((id: string | null) => {
    setHoveredFloorId(id && verifiedBands.some(band => band.id === id) ? id : null);
  }, []);

  function reset() {
    if (address.floorId || address.invalidFloor) navigate(address.view);
    viewport.current?.reset();
  }

  function overview() {
    if (address.view === "arrival") viewport.current?.reset();
    navigate("arrival");
  }

  const selected = floors.find(floor => floor.id === address.floorId);
  const handoff = selected ? getFloorHandoff(selected, images.facade.id) : null;
  const visualFloor = verifiedBands.some(band => band.id === address.floorId) ? address.floorId : null;
  const state = selected ? "FLOOR_SELECTED"
    : hoveredFloorId && address.view === "facade" ? "FLOOR_HOVER"
      : address.view === "facade" ? "BUILDING_FOCUS" : "OVERVIEW";

  return (
    <main lang="hr" data-exterior-explorer data-state={state} data-view={address.view}
      data-floor={address.floorId ?? undefined} data-handoff={handoff?.status}>
      <ExplorerShell
        floors={floorControls}
        selectedFloorId={address.floorId}
        planProofUrl={selected ? planProofHref(selected.id) : undefined}
        view={address.view}
        invalidFloor={address.invalidFloor}
        onFloorSelect={selectFloor}
        onFloorHover={onFloorHover}
        onOverview={overview}
        onBuildingFocus={() => navigate("facade")}
        onReset={reset}
        onZoom={direction => viewport.current?.zoom(direction)}
      >
        <ExteriorViewport
          ref={viewport}
          images={images}
          bands={verifiedBands}
          view={address.view}
          selectedFloorId={visualFloor}
          hoveredFloorId={hoveredFloorId}
          onFloorSelect={selectFloor}
          onFloorHover={onFloorHover}
        />
      </ExplorerShell>
    </main>
  );
}
