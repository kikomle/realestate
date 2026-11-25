"use client";

import { ArrowUpRight, Trash2, X } from "lucide-react";
import type { SelectorUnit } from "@/lib/mocire/types";
import { formatArea, STATUS_META } from "@/lib/mocire/status-colors";

type Props = {
  units: readonly SelectorUnit[];
  onClose: () => void;
  onRemove: (unitId: string) => void;
  onOpenUnit: (unit: SelectorUnit) => void;
};

export function ComparisonModal({ units, onClose, onRemove, onOpenUnit }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Usporedba stanova"
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#1b1917] text-stone-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-heading text-xl font-normal tracking-tight">Usporedba stanova</h2>
            <p className="text-xs text-stone-400">Odabrano stanova: {units.length} (maks. 4)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori usporedbu"
            className="rounded-full border border-white/15 p-2 text-stone-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-auto p-6">
          {units.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-400">
              Dodajte barem jedan stan pomoću ikone vage na karticama stanova.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {units.map((u) => {
                const meta = STATUS_META[u.status];
                return (
                  <div
                    key={u.unit_id}
                    className="flex flex-col rounded-xl border border-white/12 bg-[#23201d] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badgeBg} ${meta.badgeText}`}
                      >
                        <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemove(u.unit_id)}
                        aria-label={`Ukloni ${u.unit_id}`}
                        className="rounded-md p-1 text-stone-400 hover:bg-white/10 hover:text-rose-300"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {u.unit_plan_url && (
                      <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u.unit_plan_url}
                          alt={`Tlocrt ${u.unit_id}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}

                    <h3 className="text-base font-semibold text-white">Stan {u.unit_id}</h3>
                    <p className="mb-3 text-xs text-stone-400">
                      {u.floor_label} · {u.unit_type}
                    </p>

                    <dl className="space-y-1.5 border-y border-white/10 py-3 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-stone-400">Obračunska (NKP)</dt>
                        <dd className="font-medium text-white">{u.listing_area_raw} m²</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-stone-400">Ukupno NP</dt>
                        <dd className="text-stone-200">{formatArea(u.np_total_m2)} m²</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-stone-400">Vanjski prostor</dt>
                        <dd className="text-stone-200">
                          {u.exterior_area_m2 > 0
                            ? `${formatArea(u.exterior_area_m2)} m² (${u.exterior_label})`
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-stone-400">Cijena</dt>
                        <dd className="text-amber-200/90">Na upit</dd>
                      </div>
                    </dl>

                    <div className="my-3 flex-1 space-y-1 text-[11px]">
                      <p className="font-medium text-stone-300">Prostorije:</p>
                      {u.rooms.map((r, i) => (
                        <div key={`${r.number}-${i}`} className="flex justify-between text-stone-400">
                          <span className="truncate pr-2">{r.label}</span>
                          <span className="shrink-0 text-stone-300">{formatArea(r.np_m2)} m²</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenUnit(u);
                        onClose();
                      }}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-stone-200"
                    >
                      Otvori stan <ArrowUpRight className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
