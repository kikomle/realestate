"use client";

import { useMemo, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { SelectorFloor, SelectorUnit } from "@/lib/mocire/types";
import { STATUS_META } from "@/lib/mocire/status-colors";
import type { HoverPointerInfo } from "./BuildingCanvas3D";

type Props = {
  floor: SelectorFloor;
  units: readonly SelectorUnit[];
  matchingUnitIds: ReadonlySet<string>;
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  onHoverUnit: (info: HoverPointerInfo | null) => void;
  onSelectUnit: (unit: SelectorUnit) => void;
};

export function FloorPlan2DView({
  floor,
  units,
  matchingUnitIds,
  selectedUnitId,
  hoveredUnitId,
  onHoverUnit,
  onSelectUnit,
}: Props) {
  const [variant, setVariant] = useState<"main" | "gallery">("main");
  const [zoom, setZoom] = useState(1);

  const hasGallery = floor.plans.some((p) => p.variant === "gallery");
  const activePlan =
    floor.plans.find((p) => p.variant === (hasGallery ? variant : "main")) ?? floor.plans[0];

  const unitMap = useMemo(
    () => new Map(units.map((u) => [u.unit_id, u])),
    [units],
  );

  if (!activePlan) return null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-auto bg-[#1b1917] p-6 pt-20 pb-28">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-xs font-medium text-stone-200">
          {floor.label} · {floor.unit_ids.length} stanova
        </span>
        {hasGallery && (
          <div className="flex rounded-full border border-white/15 bg-black/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setVariant("main")}
              className={`rounded-full px-3 py-1 transition ${
                variant === "main" ? "bg-white text-stone-950 font-medium" : "text-stone-300 hover:text-white"
              }`}
            >
              Glavni tlocrt
            </button>
            <button
              type="button"
              onClick={() => setVariant("gallery")}
              className={`rounded-full px-3 py-1 transition ${
                variant === "gallery" ? "bg-white text-stone-950 font-medium" : "text-stone-300 hover:text-white"
              }`}
            >
              Galerija
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/50 p-0.5">
          <button
            type="button"
            aria-label="Smanji tlocrt"
            onClick={() => setZoom((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))}
            className="rounded-full p-1.5 text-stone-200 hover:bg-white/10"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="min-w-11 text-center text-xs text-stone-300">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Povećaj tlocrt"
            onClick={() => setZoom((z) => Math.min(2.25, Number((z + 0.25).toFixed(2))))}
            className="rounded-full p-1.5 text-stone-200 hover:bg-white/10"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Vrati povećanje"
            onClick={() => setZoom(1)}
            className="rounded-full p-1.5 text-stone-200 hover:bg-white/10"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div
        className="relative max-w-full overflow-auto rounded-xl border border-white/15 bg-white shadow-2xl"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <div
          className="relative origin-top-left transition-transform duration-200"
          style={{ width: `${Math.round(1080 * zoom)}px` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activePlan.image_url}
            alt={`Tlocrt: ${floor.label}`}
            width={activePlan.width_px}
            height={activePlan.height_px}
            className="block h-auto w-full select-none"
            draggable={false}
          />
          <svg
            viewBox={activePlan.viewBox}
            className="absolute inset-0 h-full w-full"
            aria-label={`Interaktivni tlocrt ${floor.label}`}
          >
            {activePlan.polygons.map((poly) => {
              const unit = unitMap.get(poly.unitId);
              if (!unit) return null;
              const meta = STATUS_META[unit.status];
              const isMatched = matchingUnitIds.has(unit.unit_id);
              const isHovered = hoveredUnitId === unit.unit_id;
              const isSelected = selectedUnitId === unit.unit_id;
              const fill = isSelected || isHovered ? meta.hoverRgba : isMatched ? meta.fillRgba : "rgba(120,113,108,0.12)";
              const stroke = isSelected || isHovered ? "#ffffff" : isMatched ? meta.strokeHex : "rgba(120,113,108,0.35)";

              return (
                <polygon
                  key={poly.unitId}
                  points={poly.points}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected || isHovered ? 4 : 2}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer transition-colors duration-150"
                  onMouseEnter={(e) => onHoverUnit({ unit, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => onHoverUnit({ unit, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => onHoverUnit(null)}
                  onClick={() => onSelectUnit(unit)}
                >
                  <title>{`${unit.unit_id} · ${unit.status} · ${unit.listing_area_raw} m²`}</title>
                </polygon>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
