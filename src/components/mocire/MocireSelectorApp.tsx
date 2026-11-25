"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Building2,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Heart,
  Layers,
  Mail,
  Map,
  Ruler,
  Scale,
  Search,
  SlidersHorizontal,
  Sun,
  Sunrise,
  X,
} from "lucide-react";
import type { AvailabilityStatus, SelectorDataset, SelectorUnit } from "@/lib/mocire/types";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  filterUnits,
  formatArea,
  STATUS_META,
  type FilterState,
} from "@/lib/mocire/status-colors";
import {
  getCameraPresets,
  type CameraPresetId,
  type HoverPointerInfo,
  type LightingMood,
} from "./BuildingCanvas3D";
import { FloorPlan2DView } from "./FloorPlan2DView";
import { ExteriorPhotoGallery } from "./ExteriorPhotoGallery";
import { ApartmentDetailSidebar } from "./ApartmentDetailSidebar";
import { ComparisonModal } from "./ComparisonModal";
import { ContactModal } from "./ContactModal";
import { BuildingInfoModal } from "./BuildingInfoModal";

const BuildingCanvas3D = dynamic(
  () => import("./BuildingCanvas3D").then((m) => m.BuildingCanvas3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#cfdce6] text-stone-700">
        <div className="rounded-xl border border-stone-900/10 bg-white/75 px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-md">
          Učitavanje 3D modela zgrade Močire H…
        </div>
      </div>
    ),
  },
);

export type ViewMode = "3d" | "plan3d" | "plan2d" | "photos";

type InitialSelection = {
  mode?: ViewMode;
  floorId?: string;
  unitId?: string | null;
};

export function MocireSelectorApp({
  dataset,
  initial,
}: {
  dataset: SelectorDataset;
  initial?: InitialSelection;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(initial?.mode ?? "3d");
  const [activeFloorId, setActiveFloorId] = useState<string>(initial?.floorId ?? "L02");
  const [plan3dVariant, setPlan3dVariant] = useState<"main" | "gallery">("main");
  const [lightingMood, setLightingMood] = useState<LightingMood>("golden");
  const [presetId, setPresetId] = useState<CameraPresetId>("se");
  const [presetVersion, setPresetVersion] = useState(0);
  const [focusVersion, setFocusVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllOverlays, setShowAllOverlays] = useState(true);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(initial?.unitId ?? null);
  const [hoverInfo, setHoverInfo] = useState<HoverPointerInfo | null>(null);
  const [cardHoveredId, setCardHoveredId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [compassAngle, setCompassAngle] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);

  const presets = useMemo(() => getCameraPresets(dataset.building_m), [dataset.building_m]);

  // Keep URL query synchronized with selection/view state
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", viewMode);
    if (viewMode === "plan3d" || viewMode === "plan2d" || selectedUnitId) {
      url.searchParams.set("floor", activeFloorId);
    } else {
      url.searchParams.delete("floor");
    }
    if (selectedUnitId) {
      url.searchParams.set("unit", selectedUnitId);
    } else {
      url.searchParams.delete("unit");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [viewMode, activeFloorId, selectedUnitId]);

  // Close open modals with Escape key
  useEffect(() => {
    if (!compareOpen && !contactOpen && !infoOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setCompareOpen(false);
      setContactOpen(false);
      setInfoOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [compareOpen, contactOpen, infoOpen]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const id = window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2600);
    return () => window.clearTimeout(id);
  }, []);

  const filteredUnits = useMemo(
    () => filterUnits(dataset.units, filters, favorites),
    [dataset.units, filters, favorites],
  );
  const matchingUnitIds = useMemo(
    () => new Set(filteredUnits.map((u) => u.unit_id)),
    [filteredUnits],
  );
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const selectedUnit = useMemo(
    () => dataset.units.find((u) => u.unit_id === selectedUnitId) ?? null,
    [dataset.units, selectedUnitId],
  );
  const activeFloor = useMemo(
    () => dataset.floors.find((f) => f.floor_id === activeFloorId) ?? dataset.floors[0],
    [dataset.floors, activeFloorId],
  );
  const comparedUnits = useMemo(
    () => compareIds.map((id) => dataset.units.find((u) => u.unit_id === id)).filter(Boolean) as SelectorUnit[],
    [compareIds, dataset.units],
  );

  const counts = useMemo(() => {
    let available = 0;
    let reserved = 0;
    let sold = 0;
    for (const u of dataset.units) {
      if (u.status === "Slobodno") available++;
      else if (u.status === "Rezervirano") reserved++;
      else sold++;
    }
    return { available, reserved, sold };
  }, [dataset.units]);

  const handleSelectUnit = useCallback((unit: SelectorUnit) => {
    setSelectedUnitId(unit.unit_id);
    setActiveFloorId(unit.floor_id);
    // Automatically select that floor's 3D cutaway & zoom directly onto the clicked apartment
    setViewMode((curr) => (curr === "plan2d" ? "plan2d" : "plan3d"));
    setFocusVersion((v) => v + 1);
    setSidebarOpen(true);
    setHoverInfo(null);
  }, []);

  const handleToggleFavorite = useCallback(
    (unitId: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(unitId)) {
          next.delete(unitId);
          showToast(`Stan ${unitId} uklonjen iz favorita`);
        } else {
          next.add(unitId);
          showToast(`Stan ${unitId} dodan u favorite`);
        }
        return next;
      });
    },
    [showToast],
  );

  const handleToggleCompare = useCallback(
    (unitId: string) => {
      setCompareIds((prev) => {
        if (prev.includes(unitId)) {
          showToast(`Stan ${unitId} uklonjen iz usporedbe`);
          return prev.filter((id) => id !== unitId);
        }
        if (prev.length >= 4) {
          showToast("Možete usporediti najviše 4 stana odjednom");
          return prev;
        }
        showToast(`Stan ${unitId} dodan na usporedbu`);
        return [...prev, unitId];
      });
    },
    [showToast],
  );

  const handleCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    showToast("Poveznica kopirana u međuspremnik");
  }, [showToast]);

  const cyclePreset = useCallback(
    (dir: -1 | 1) => {
      setViewMode("3d");
      setSelectedUnitId(null);
      setPresetId((curr) => {
        const idx = presets.findIndex((p) => p.id === curr);
        const next = (idx + dir + presets.length) % presets.length;
        return presets[next].id;
      });
      setPresetVersion((v) => v + 1);
    },
    [presets],
  );

  const hoveredUnitId = hoverInfo?.unit.unit_id ?? cardHoveredId;

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden bg-[#151412] font-sans text-stone-100"
      lang="hr"
      data-testid="mocire-selector-app"
    >
      {/* MAIN FULL-BLEED VIEWPORT */}
      <main
        className={`absolute inset-0 transition-[padding] duration-300 ${
          sidebarOpen && (viewMode === "plan2d" || viewMode === "photos") ? "lg:pl-[396px]" : ""
        }`}
      >
        {viewMode === "3d" || viewMode === "plan3d" ? (
          <BuildingCanvas3D
            modelUrl={dataset.model_url}
            building={dataset.building_m}
            floors={dataset.floors}
            units={dataset.units}
            matchingUnitIds={matchingUnitIds}
            viewMode={viewMode}
            activeFloorId={activeFloorId}
            planVariant={activeFloorId === "L04" ? plan3dVariant : "main"}
            presetId={presetId}
            presetVersion={presetVersion}
            focusVersion={focusVersion}
            sidebarOpen={sidebarOpen}
            lightingMood={lightingMood}
            selectedUnitId={selectedUnitId}
            hoveredUnitId={hoveredUnitId}
            showAllOverlays={showAllOverlays}
            onHoverUnit={setHoverInfo}
            onSelectUnit={handleSelectUnit}
            onCompassAngle={setCompassAngle}
          />
        ) : viewMode === "plan2d" ? (
          <FloorPlan2DView
            floor={activeFloor}
            units={dataset.units}
            matchingUnitIds={matchingUnitIds}
            selectedUnitId={selectedUnitId}
            hoveredUnitId={hoveredUnitId}
            onHoverUnit={setHoverInfo}
            onSelectUnit={handleSelectUnit}
          />
        ) : (
          <ExteriorPhotoGallery photos={dataset.exterior_photos} />
        )}
      </main>

      {/* FLOATING KOZIELSKA-STYLE HOVER TOOLTIP CARD */}
      {hoverInfo && (
        <div
          className="pointer-events-none fixed z-40 w-60 rounded-xl border border-white/20 bg-[#1a1816]/88 p-3 text-stone-100 shadow-2xl backdrop-blur-xl transition-opacity"
          style={{
            left: Math.min(hoverInfo.x + 18, typeof window !== "undefined" ? window.innerWidth - 260 : hoverInfo.x + 18),
            top: Math.max(76, Math.min(hoverInfo.y - 24, typeof window !== "undefined" ? window.innerHeight - 170 : hoverInfo.y)),
          }}
          data-testid="apartment-hover-tooltip"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${STATUS_META[hoverInfo.unit.status].dotClass}`} />
              <span className="text-sm font-semibold text-white">Stan {hoverInfo.unit.unit_id}</span>
            </div>
            <ArrowUpRight className="size-4 text-stone-300" />
          </div>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {STATUS_META[hoverInfo.unit.status].label} · {hoverInfo.unit.floor_label}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-white/10 pt-2 text-[11px]">
            <div>
              <dt className="text-stone-400">Površina</dt>
              <dd className="font-semibold text-white">{hoverInfo.unit.listing_area_raw} m²</dd>
            </div>
            <div>
              <dt className="text-stone-400">Sobnost</dt>
              <dd className="font-medium text-stone-200">{hoverInfo.unit.unit_type}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Etaža</dt>
              <dd className="text-stone-200">{hoverInfo.unit.floor_label}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Cijena</dt>
              <dd className="font-medium text-amber-200">Na upit</dd>
            </div>
          </dl>
        </div>
      )}

      {/* TOP FROSTED ARCHITECTURAL HEADER BAR */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/15 bg-[#191715]/80 px-3.5 py-2 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-base font-normal tracking-tight text-white">
              Močire <span className="text-amber-300">H</span>
            </span>
            <span className="text-[10px] tracking-wider text-stone-400 uppercase">Zadar · 94 stana</span>
          </div>
          {selectedUnit && (
            <button
              type="button"
              onClick={() => {
                setSelectedUnitId(null);
                setViewMode("3d");
                setPresetVersion((v) => v + 1);
              }}
              className="ml-1 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-stone-100 hover:bg-white/20"
            >
              <ChevronLeft className="size-3.5" /> Zgrada H
            </button>
          )}
        </div>

        {/* Center Mode Switcher */}
        <nav
          aria-label="Način prikaza"
          className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/15 bg-[#191715]/80 p-1 shadow-lg backdrop-blur-xl sm:gap-1"
        >
          {(
            [
              { id: "3d", label: "3D Zgrada", short: "3D", icon: Building2 },
              { id: "plan3d", label: "Plan 3D", short: "Plan", icon: Layers },
              { id: "plan2d", label: "Tlocrt 2D", short: "2D", icon: Map },
              { id: "photos", label: "Fotografije", short: "Foto", icon: Camera },
            ] as const
          ).map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              aria-pressed={viewMode === id}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 ${
                viewMode === id
                  ? "bg-white text-stone-950 shadow-sm"
                  : "text-stone-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{short}</span>
            </button>
          ))}
        </nav>

        {/* Right Status Legend + Info + Contact */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* 3-color availability legend */}
          <div
            className="hidden items-center gap-3 rounded-xl border border-white/15 bg-[#191715]/80 px-3 py-2 text-[11px] shadow-lg backdrop-blur-xl xl:flex"
            aria-label="Legenda dostupnosti"
          >
            {(
              [
                { status: "Slobodno", count: counts.available },
                { status: "Rezervirano", count: counts.reserved },
                { status: "Prodano", count: counts.sold },
              ] as { status: AvailabilityStatus; count: number }[]
            ).map(({ status, count }) => {
              const meta = STATUS_META[status];
              const active = filters.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      status: f.status === status ? "ALL" : status,
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition ${
                    active ? "bg-white/20 text-white ring-1 ring-white/40" : "text-stone-300 hover:text-white"
                  }`}
                  title={`Filtriraj: ${meta.label}`}
                >
                  <span className={`size-2 rounded-full ${meta.dotClass}`} />
                  <span>{meta.label}</span>
                  <span className="font-semibold text-white">{count}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            title="Kalibrirane dimenzije 3D modela"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#191715]/80 px-3 py-2 text-xs font-medium text-stone-200 shadow-lg backdrop-blur-xl transition hover:bg-white/15 hover:text-white"
          >
            <Ruler className="size-3.5 text-amber-300" />
            <span className="hidden sm:inline">Dimenzije</span>
          </button>

          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-stone-950 shadow-lg transition hover:bg-stone-200"
          >
            <Mail className="size-3.5" />
            KONTAKT
          </button>
        </div>
      </header>

      {/* COLLAPSIBLE LEFT SIDEBAR (KOZIELSKA STYLE) */}
      <aside
        className={`fixed top-16 bottom-4 left-4 z-30 flex transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+16px)]"
        }`}
        aria-label="Popis stanova i filteri"
      >
        <div className="flex h-full w-[330px] max-w-[86vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#191715]/84 shadow-2xl backdrop-blur-xl sm:w-[370px]">
          {selectedUnit ? (
            <ApartmentDetailSidebar
              unit={selectedUnit}
              isFavorite={favorites.has(selectedUnit.unit_id)}
              isCompared={compareIds.includes(selectedUnit.unit_id)}
              onBack={() => setSelectedUnitId(null)}
              onToggleFavorite={handleToggleFavorite}
              onToggleCompare={handleToggleCompare}
              onCopyLink={handleCopyLink}
              onOpenContact={() => setContactOpen(true)}
              onOpenFloor2D={(fid) => {
                setActiveFloorId(fid);
                setViewMode("plan2d");
              }}
              onOpenFloor3D={(fid) => {
                setActiveFloorId(fid);
                setViewMode("plan3d");
              }}
            />
          ) : (
            <>
              {/* Filter Bar Header */}
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((o) => !o)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-amber-200"
                  >
                    <SlidersHorizontal className="size-3.5 text-amber-300" />
                    <span>Filteri</span>
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/15 text-[11px]">
                      {activeFilterCount}
                    </span>
                    {filtersOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="text-[11px] font-medium text-amber-200 hover:underline"
                    >
                      Očisti filtere
                    </button>
                  )}
                </div>

                {/* Collapsible Filter Drawer */}
                {filtersOpen && (
                  <div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-xs">
                    {/* Search */}
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-stone-400" />
                      <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        placeholder="Traži stan (npr. H 2.1, Trosoban)…"
                        className="w-full rounded-lg border border-white/15 bg-black/40 py-2 pr-3 pl-8 text-xs text-white placeholder:text-stone-500 outline-none focus:border-amber-300"
                      />
                    </div>

                    {/* Floor & Status */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-stone-400" htmlFor="filter-floor">
                          Etaža
                        </label>
                        <select
                          id="filter-floor"
                          value={filters.floorId}
                          onChange={(e) => setFilters((f) => ({ ...f, floorId: e.target.value }))}
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-stone-100 outline-none focus:border-amber-300"
                        >
                          <option value="ALL">Sve etaže</option>
                          {dataset.floors.map((fl) => (
                            <option key={fl.floor_id} value={fl.floor_id}>
                              {fl.label} ({fl.available_count} slob.)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-stone-400" htmlFor="filter-status">
                          Status
                        </label>
                        <select
                          id="filter-status"
                          value={filters.status}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              status: e.target.value as FilterState["status"],
                            }))
                          }
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-stone-100 outline-none focus:border-amber-300"
                        >
                          <option value="ALL">Svi statusi</option>
                          <option value="Slobodno">Slobodno (Zeleno)</option>
                          <option value="Rezervirano">Rezervirano (Žuto)</option>
                          <option value="Prodano">Prodano (Crveno)</option>
                        </select>
                      </div>
                    </div>

                    {/* Rooms */}
                    <div>
                      <span className="mb-1 block text-[11px] text-stone-400">Sobnost</span>
                      <div className="flex gap-1">
                        {[null, 2, 3, 4, 5].map((r) => (
                          <button
                            key={String(r)}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, rooms: r }))}
                            className={`flex-1 rounded-lg border py-1 text-xs font-medium transition ${
                              filters.rooms === r
                                ? "border-amber-300 bg-amber-400/20 text-amber-100"
                                : "border-white/12 bg-black/30 text-stone-300 hover:bg-white/10"
                            }`}
                          >
                            {r === null ? "Sve" : `${r}s`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Area range */}
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-stone-400">
                        <span>Površina (m²)</span>
                        <span className="text-stone-200">
                          {filters.minArea} – {filters.maxArea} m²
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={35}
                          max={filters.maxArea}
                          value={filters.minArea}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, minArea: Number(e.target.value) || 35 }))
                          }
                          aria-label="Minimalna površina m²"
                          className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white"
                        />
                        <input
                          type="number"
                          min={filters.minArea}
                          max={120}
                          value={filters.maxArea}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, maxArea: Number(e.target.value) || 120 }))
                          }
                          aria-label="Maksimalna površina m²"
                          className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-stone-300">
                      {(
                        [
                          { key: "onlyAvailable", label: "Samo slobodno" },
                          { key: "onlyFavorites", label: `Favoriti (${favorites.size})` },
                          { key: "onlyBalcony", label: "Balkon" },
                          { key: "onlyLoggia", label: "Lođa" },
                          { key: "onlyTerrace", label: "Terasa / Vrt" },
                        ] as const
                      ).map(({ key, label }) => (
                        <label key={key} className="flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={filters[key]}
                            onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.checked }))}
                            className="accent-amber-400"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Offers summary + Compare button */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs">
                <span className="font-semibold tracking-wide text-stone-200">
                  PONUDE: <strong className="text-white">{filteredUnits.length}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-stone-200 transition hover:bg-white/15"
                >
                  <Scale className="size-3.5 text-amber-300" />
                  Usporedba
                  <span className="rounded-full bg-white/15 px-1.5 text-[10px] font-semibold text-white">
                    {compareIds.length}
                  </span>
                </button>
              </div>

              {/* 2-Column Apartment Cards Grid (Kozielska style) */}
              <div className="flex-1 overflow-y-auto p-3">
                {filteredUnits.length === 0 ? (
                  <div className="py-12 text-center text-xs text-stone-400">
                    Nema stanova za odabrane filtere.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {filteredUnits.map((unit) => {
                      const meta = STATUS_META[unit.status];
                      const isFav = favorites.has(unit.unit_id);
                      const isCmp = compareIds.includes(unit.unit_id);
                      const isHov = hoveredUnitId === unit.unit_id;
                      return (
                        <div
                          key={unit.unit_id}
                          onMouseEnter={() => setCardHoveredId(unit.unit_id)}
                          onMouseLeave={() => setCardHoveredId(null)}
                          className={`group flex flex-col overflow-hidden rounded-xl border bg-[#24211e]/90 transition ${
                            isHov
                              ? "border-amber-300/80 ring-1 ring-amber-300/40"
                              : "border-white/10 hover:border-white/25"
                          }`}
                        >
                          {/* Floorplan thumbnail + status pill */}
                          <button
                            type="button"
                            onClick={() => handleSelectUnit(unit)}
                            className="relative flex h-28 w-full items-center justify-center bg-white p-2 text-left"
                          >
                            <span
                              className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-stone-900 shadow-sm`}
                            >
                              <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
                              {meta.label}
                            </span>
                            {unit.unit_plan_url && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={unit.unit_plan_url}
                                alt={`Tlocrt ${unit.unit_id}`}
                                loading="lazy"
                                className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                              />
                            )}
                          </button>

                          {/* Card metadata */}
                          <div className="flex flex-1 flex-col p-2.5 text-[11px]">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => handleSelectUnit(unit)}
                                className="truncate text-xs font-semibold text-white hover:text-amber-200"
                              >
                                Stan {unit.unit_id}
                              </button>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Favorit ${unit.unit_id}`}
                                  onClick={() => handleToggleFavorite(unit.unit_id)}
                                  className={`rounded p-1 transition ${
                                    isFav ? "text-rose-400" : "text-stone-400 hover:text-white"
                                  }`}
                                >
                                  <Heart className={`size-3 ${isFav ? "fill-current" : ""}`} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Usporedi ${unit.unit_id}`}
                                  onClick={() => handleToggleCompare(unit.unit_id)}
                                  className={`rounded p-1 transition ${
                                    isCmp ? "text-amber-300" : "text-stone-400 hover:text-white"
                                  }`}
                                >
                                  <Scale className="size-3" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-1.5 space-y-0.5 text-[10px] text-stone-400">
                              <div className="flex justify-between">
                                <span>Površina:</span>
                                <span className="font-medium text-stone-100">{unit.listing_area_raw} m²</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Etaža:</span>
                                <span className="text-stone-200">{unit.floor_label}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Sobnost:</span>
                                <span className="text-stone-200">{unit.unit_type}</span>
                              </div>
                              {unit.exterior_area_m2 > 0 && (
                                <div className="flex justify-between">
                                  <span>{unit.exterior_label}:</span>
                                  <span className="text-stone-200">{formatArea(unit.exterior_area_m2)} m²</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
                              <span className="text-stone-400">Cijena</span>
                              <span className="font-semibold text-amber-200">Na upit</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar Collapse / Expand Tab (Kozielska style) */}
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? "Sakrij bočnu traku" : "Prikaži bočnu traku"}
          className="ml-2 mt-4 flex h-10 items-center gap-1 self-start rounded-xl border border-white/15 bg-[#191715]/85 px-2.5 text-xs font-medium text-stone-100 shadow-lg backdrop-blur-xl transition hover:bg-black"
        >
          {sidebarOpen ? (
            <ChevronLeft className="size-4" />
          ) : (
            <>
              <ChevronRight className="size-4" />
              <span>Ponude</span>
            </>
          )}
        </button>
      </aside>

      {/* BOTTOM CAMERA & FLOOR DOCK (KOZIELSKA STYLE) */}
      <div
        className={`pointer-events-none fixed right-4 bottom-4 z-30 flex items-end justify-center transition-all duration-300 ${
          sidebarOpen ? "left-4 lg:left-[400px]" : "left-4"
        }`}
      >
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#191715]/84 px-3 py-2 shadow-2xl backdrop-blur-xl">
          {/* Prev / Next camera preset arrows */}
          <button
            type="button"
            aria-label="Prethodni kut kamere"
            onClick={() => cyclePreset(-1)}
            className="rounded-lg border border-white/12 bg-white/5 p-2 text-stone-200 transition hover:bg-white/15 hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* Exterior 3D camera presets */}
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-[10px] font-semibold tracking-wider text-stone-400 uppercase sm:inline">
              Izvana
            </span>
            {presets.map((p) => {
              const active = viewMode === "3d" && presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setViewMode("3d");
                    setSelectedUnitId(null);
                    setPresetId(p.id);
                    setPresetVersion((v) => v + 1);
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "bg-white text-stone-950 shadow-sm"
                      : "bg-white/5 text-stone-300 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="hidden h-5 w-px bg-white/15 sm:block" />

          {/* Plan 3D / 2D Floor selector pills */}
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-[10px] font-semibold tracking-wider text-stone-400 uppercase sm:inline">
              Plan 3D
            </span>
            {dataset.floors.map((fl) => {
              const active = (viewMode === "plan3d" || viewMode === "plan2d") && activeFloorId === fl.floor_id;
              return (
                <button
                  key={fl.floor_id}
                  type="button"
                  onClick={() => {
                    setActiveFloorId(fl.floor_id);
                    setSelectedUnitId(null);
                    setFocusVersion((v) => v + 1);
                    if (viewMode !== "plan2d") setViewMode("plan3d");
                  }}
                  title={`${fl.label} (${fl.available_count} slobodno)`}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "bg-amber-300 text-stone-950 font-semibold shadow-sm"
                      : "bg-white/5 text-stone-300 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {fl.short_label}
                </button>
              );
            })}
          </div>

          {/* Toggle lighting mood (Golden Hour / Daylight) + L04 Gallery in Plan 3D */}
          {(viewMode === "3d" || viewMode === "plan3d") && (
            <>
              <div className="hidden h-5 w-px bg-white/15 sm:block" />
              {viewMode === "3d" && (
                <button
                  type="button"
                  onClick={() => setShowAllOverlays((v) => !v)}
                  title={showAllOverlays ? "Priguši pravokutnike" : "Prikaži sve pravokutnike stanova"}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                    showAllOverlays
                      ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                      : "bg-white/5 text-stone-300 hover:bg-white/15"
                  }`}
                >
                  {showAllOverlays ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  <span className="hidden md:inline">Stanovi</span>
                </button>
              )}
              {viewMode === "plan3d" && activeFloorId === "L04" && (
                <button
                  type="button"
                  onClick={() => setPlan3dVariant((v) => (v === "main" ? "gallery" : "main"))}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                    plan3dVariant === "gallery"
                      ? "bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/50"
                      : "bg-white/5 text-stone-300 hover:bg-white/15"
                  }`}
                >
                  {plan3dVariant === "gallery" ? "Galerija" : "Glavni L04"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setLightingMood((m) => (m === "golden" ? "day" : "golden"))}
                title={lightingMood === "golden" ? "Prebaci na dnevno svjetlo" : "Prebaci na zlatni sat"}
                className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-stone-200 transition hover:bg-white/15 hover:text-white"
              >
                {lightingMood === "golden" ? (
                  <>
                    <Sunrise className="size-3.5 text-amber-300" />
                    <span className="hidden lg:inline">Zlatni sat</span>
                  </>
                ) : (
                  <>
                    <Sun className="size-3.5 text-sky-300" />
                    <span className="hidden lg:inline">Dan</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            aria-label="Sljedeći kut kamere"
            onClick={() => cyclePreset(1)}
            className="rounded-lg border border-white/12 bg-white/5 p-2 text-stone-200 transition hover:bg-white/15 hover:text-white"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* DYNAMIC COMPASS (BOTTOM-RIGHT, KOZIELSKA STYLE) */}
      {(viewMode === "3d" || viewMode === "plan3d") && (
        <div
          className="pointer-events-none fixed right-5 bottom-20 z-30 hidden size-12 items-center justify-center rounded-full border border-white/20 bg-[#191715]/75 text-stone-100 shadow-lg backdrop-blur-xl sm:flex"
          aria-label="Kompas"
        >
          <div
            className="relative flex size-9 items-center justify-center transition-transform duration-100"
            style={{ transform: `rotate(${-compassAngle}deg)` }}
          >
            <span className="absolute -top-0.5 text-[9px] font-bold text-amber-300">N</span>
            <div className="h-4 w-0.5 rounded-full bg-gradient-to-b from-amber-300 via-white to-stone-500" />
          </div>
        </div>
      )}

      {/* DISMISSIBLE DISCLAIMER TOAST (BOTTOM-RIGHT ABOVE COMPASS / SUBTLE) */}
      {disclaimerOpen && (
        <div className="fixed top-18 right-4 z-20 hidden max-w-xs items-start gap-2 rounded-xl border border-white/12 bg-[#191715]/78 px-3 py-2 text-[11px] leading-snug text-stone-300 shadow-lg backdrop-blur-md xl:flex">
          <p>
            Povucite za rotaciju 3D zgrade · Prijeđite mišem preko pravokutnika stana za pregled i kliknite za
            odabir.
          </p>
          <button
            type="button"
            aria-label="Zatvori uputu"
            onClick={() => setDisclaimerOpen(false)}
            className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ACTION TOAST */}
      {toast && (
        <div
          role="status"
          className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/20 bg-stone-950/90 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur-md"
        >
          {toast}
        </div>
      )}

      {/* MODALS */}
      {compareOpen && (
        <ComparisonModal
          units={comparedUnits}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
          onOpenUnit={handleSelectUnit}
        />
      )}
      {contactOpen && <ContactModal unit={selectedUnit} onClose={() => setContactOpen(false)} />}
      {infoOpen && (
        <BuildingInfoModal
          building={dataset.building_m}
          floors={dataset.floors}
          asOfDate={dataset.as_of_date}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
}
