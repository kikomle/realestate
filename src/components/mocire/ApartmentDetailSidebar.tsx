"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  FileText,
  Heart,
  Layers,
  Mail,
  Maximize2,
  Scale,
  X,
} from "lucide-react";
import type { SelectorUnit } from "@/lib/mocire/types";
import { formatArea, STATUS_META } from "@/lib/mocire/status-colors";

type Props = {
  unit: SelectorUnit;
  isFavorite: boolean;
  isCompared: boolean;
  onBack: () => void;
  onToggleFavorite: (unitId: string) => void;
  onToggleCompare: (unitId: string) => void;
  onCopyLink: () => void;
  onOpenContact: () => void;
  onOpenFloor2D: (floorId: string) => void;
  onOpenFloor3D: (floorId: string) => void;
};

export function ApartmentDetailSidebar({
  unit,
  isFavorite,
  isCompared,
  onBack,
  onToggleFavorite,
  onToggleCompare,
  onCopyLink,
  onOpenContact,
  onOpenFloor2D,
  onOpenFloor3D,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const meta = STATUS_META[unit.status];
  const bb = unit.geometry3d.building_bbox_m;
  const estWidth = Math.abs(bb.x1 - bb.x0);
  const estDepth = Math.abs(bb.y1 - bb.y0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Detail header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-200 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Natrag na ponude
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleCompare(unit.unit_id)}
            aria-label="Usporedi stan"
            title="Dodaj na usporedbu"
            className={`rounded-lg border p-1.5 transition ${
              isCompared
                ? "border-amber-300/60 bg-amber-400/20 text-amber-200"
                : "border-white/10 bg-white/5 text-stone-300 hover:bg-white/10"
            }`}
          >
            <Scale className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            aria-label="Kopiraj poveznicu"
            title="Kopiraj poveznicu"
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-stone-300 transition hover:bg-white/10"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(unit.unit_id)}
            aria-label="Spremi u favorite"
            title="Favorit"
            className={`rounded-lg border p-1.5 transition ${
              isFavorite
                ? "border-rose-400/60 bg-rose-500/20 text-rose-300"
                : "border-white/10 bg-white/5 text-stone-300 hover:bg-white/10"
            }`}
          >
            <Heart className={`size-3.5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-normal tracking-tight text-white">
              Stan {unit.unit_id}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badgeBg} ${meta.badgeText}`}
            >
              <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">
            Močire Zadar H · {unit.floor_label} · {unit.unit_type}
          </p>
        </div>

        {/* Key metrics */}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <dt className="text-[11px] text-stone-400">Obračunska (NKP)</dt>
            <dd className="mt-0.5 text-base font-semibold text-white">{unit.listing_area_raw} m²</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <dt className="text-[11px] text-stone-400">Ukupno NP (PDF)</dt>
            <dd className="mt-0.5 text-base font-semibold text-stone-100">
              {formatArea(unit.np_total_m2)} m²
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <dt className="text-[11px] text-stone-400">Cijena</dt>
            <dd className="mt-0.5 font-semibold text-amber-200">Na upit</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <dt className="text-[11px] text-stone-400">Procijenjeni gabarit</dt>
            <dd className="mt-0.5 font-medium text-stone-200">
              ~{estWidth.toFixed(1)} × {estDepth.toFixed(1)} m
            </dd>
          </div>
        </dl>

        {/* Quick view switches for this apartment's floor */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenFloor3D(unit.floor_id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-stone-100 transition hover:bg-white/15"
          >
            <Layers className="size-3.5" />
            Plan 3D ({unit.floor_label})
          </button>
          <button
            type="button"
            onClick={() => onOpenFloor2D(unit.floor_id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-stone-100 transition hover:bg-white/15"
          >
            <Maximize2 className="size-3.5" />
            Tlocrt etaže 2D
          </button>
        </div>

        {/* Individual unit floorplan preview */}
        {unit.unit_plan_url && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-stone-400">
              <span>Tlocrt stana (izvorni nacrt)</span>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="text-stone-200 underline hover:text-white"
              >
                Povećaj
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white p-3 transition hover:border-amber-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={unit.unit_plan_url}
                alt={`Tlocrt stana ${unit.unit_id}`}
                className="max-h-52 w-full object-contain"
              />
            </button>
          </div>
        )}

        {/* Room-by-room schedule */}
        {unit.rooms.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Iskaz površina (PDF)
            </h3>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-stone-400">
                    <th className="px-2.5 py-1.5">Prostor</th>
                    <th className="px-2 py-1.5 text-right">NP</th>
                    <th className="px-2 py-1.5 text-right">K</th>
                    <th className="px-2.5 py-1.5 text-right">NKP</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.rooms.map((r, idx) => (
                    <tr key={`${r.number}-${idx}`} className="border-b border-white/5 last:border-0">
                      <td className="px-2.5 py-1.5 text-stone-200">
                        <span className="mr-1.5 text-stone-500">{r.number}</span>
                        {r.label}
                      </td>
                      <td className="px-2 py-1.5 text-right text-stone-300">{formatArea(r.np_m2)}</td>
                      <td className="px-2 py-1.5 text-right text-stone-400">{r.coefficient}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium text-white">
                        {formatArea(r.nkp_m2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions (Kozielska style) */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onOpenContact}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-stone-950 transition hover:bg-stone-200"
          >
            <Mail className="size-4" />
            KONTAKT / POŠALJI UPIT
          </button>

          <div className="grid grid-cols-2 gap-2">
            {unit.pdf_url && (
              <a
                href={unit.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-white/10"
              >
                <FileText className="size-3.5" />
                PDF stana
              </a>
            )}
            <a
              href={unit.source_ref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-white/10"
            >
              Sigma oglas
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <p className="text-[10px] text-stone-500">
            Status prema Sigmi na dan {unit.status_as_of}. Cijena nije objavljena (Na upit).
          </p>
        </div>
      </div>

      {/* Fullscreen 2D unit plan lightbox */}
      {lightboxOpen && unit.unit_plan_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Uvećani tlocrt stana ${unit.unit_id}`}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Zatvori uvećani tlocrt"
              className="absolute top-3 right-3 rounded-full bg-stone-900/80 p-2 text-white hover:bg-stone-900"
            >
              <X className="size-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={unit.unit_plan_url}
              alt={`Tlocrt stana ${unit.unit_id}`}
              className="max-h-[82vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
