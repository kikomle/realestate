"use client";

import { Ruler, X } from "lucide-react";
import type { BuildingCalibration, SelectorFloor } from "@/lib/mocire/types";

type Props = {
  building: BuildingCalibration;
  floors: readonly SelectorFloor[];
  asOfDate: string;
  onClose: () => void;
};

export function BuildingInfoModal({ building, floors, asOfDate, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Kalibrirane dimenzije zgrade"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#1b1917] text-stone-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Ruler className="size-4 text-amber-300" />
            <h2 className="font-heading text-lg font-normal">Procjena dimenzija 3D modela</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori informacije"
            className="rounded-full border border-white/15 p-1.5 text-stone-300 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-6 text-xs leading-relaxed text-stone-300">
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-amber-100">
            <strong>Napomena:</strong> Sve prikazane površine stanova (Obračunska / NKP i PDF iskaz NP) izvorne su
            Sigma vrijednosti (stanje {asOfDate}). Vanjske metarske dimenzije 3D Blender modela procijenjene su iz
            tlocrta i pročelja (<code>{building.estimation_flag}</code>).
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <dt className="text-[11px] text-stone-400">Duljina (Istok–Zapad)</dt>
              <dd className="mt-1 text-base font-semibold text-white">{building.width_x.toFixed(1)} m</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <dt className="text-[11px] text-stone-400">Dubina tijela</dt>
              <dd className="mt-1 text-base font-semibold text-white">{building.depth_y.toFixed(1)} m</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <dt className="text-[11px] text-stone-400">Visina (s krovom)</dt>
              <dd className="mt-1 text-base font-semibold text-white">{building.total_height_z.toFixed(1)} m</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <dt className="text-[11px] text-stone-400">Kalibracija tlocrta</dt>
              <dd className="mt-1 text-base font-semibold text-white">{building.px_per_m.toFixed(2)} px/m</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 font-medium text-white">Etažne visine i broj stanova</h3>
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-stone-400">
                  <th className="py-1.5">Etaža</th>
                  <th className="py-1.5">Raspon Z (procjena)</th>
                  <th className="py-1.5">Stanova</th>
                  <th className="py-1.5 text-emerald-300">Slobodno</th>
                  <th className="py-1.5 text-amber-300">Rezervirano</th>
                  <th className="py-1.5 text-rose-300">Prodano</th>
                </tr>
              </thead>
              <tbody>
                {floors.map((f) => (
                  <tr key={f.floor_id} className="border-b border-white/5">
                    <td className="py-1.5 font-medium text-stone-100">{f.label}</td>
                    <td className="py-1.5 text-stone-300">
                      {f.z0.toFixed(1)} m – {f.z1.toFixed(1)} m
                    </td>
                    <td className="py-1.5">{f.unit_ids.length}</td>
                    <td className="py-1.5 text-emerald-300">{f.available_count}</td>
                    <td className="py-1.5 text-amber-300">{f.reserved_count}</td>
                    <td className="py-1.5 text-rose-300">{f.sold_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-stone-400">{building.method}</p>
        </div>
      </div>
    </div>
  );
}
