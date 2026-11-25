"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, Mail, X } from "lucide-react";
import type { SelectorUnit } from "@/lib/mocire/types";

type Props = {
  unit: SelectorUnit | null;
  onClose: () => void;
};

export function ContactModal({ unit, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    unit
      ? `Poštovani, zanima me cijena i dostupnost stana ${unit.unit_id} (${unit.floor_label}, ${unit.listing_area_raw} m²) u zgradi Močire Zadar H.`
      : "Poštovani, molim više informacija o dostupnim stanovima u projektu Močire Zadar H.",
  );
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !consent) return;
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Kontakt i upit za stan"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#1b1917] text-stone-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-amber-300" />
            <h2 className="font-heading text-lg font-normal">
              {unit ? `Upit za stan ${unit.unit_id}` : "Kontakt — Močire Zadar H"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori kontakt"
            className="rounded-full border border-white/15 p-1.5 text-stone-300 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="space-y-4 py-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Upit pripremljen (lokalni prototip)</h3>
              <p className="text-xs leading-relaxed text-stone-400">
                U lokalnom prototipu obrazac ne šalje stvarnu e-poštu. Za službeni upit izravno investitoru,
                otvorite Sigmin obrazac ispod.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <a
                  href="https://www.sigma.hr/upit-za-stan/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-stone-950 hover:bg-stone-200"
                >
                  Službeni Sigma upit <ArrowUpRight className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/15 px-4 py-2 text-xs text-stone-200 hover:bg-white/10"
                >
                  Zatvori
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block text-stone-300" htmlFor="contact-name">
                  Ime i prezime *
                </label>
                <input
                  id="contact-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-stone-100 outline-none focus:border-amber-300"
                  placeholder="Ivan Horvat"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-stone-300" htmlFor="contact-email">
                    E-mail *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-stone-100 outline-none focus:border-amber-300"
                    placeholder="ivan@primjer.hr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-stone-300" htmlFor="contact-phone">
                    Telefon
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-stone-100 outline-none focus:border-amber-300"
                    placeholder="+385 91 ..."
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-stone-300" htmlFor="contact-msg">
                  Poruka
                </label>
                <textarea
                  id="contact-msg"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-stone-100 outline-none focus:border-amber-300"
                />
              </div>
              <label className="flex items-start gap-2 text-[11px] text-stone-400">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-amber-400"
                />
                <span>Suglasan sam s obradom podataka radi odgovora na upit za projekt Močire Zadar H.</span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <a
                  href="https://www.sigma.hr/upit-za-stan/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-stone-300 underline hover:text-white"
                >
                  Otvori Sigma obrazac <ArrowUpRight className="size-3" />
                </a>
                <button
                  type="submit"
                  className="rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-stone-950 transition hover:bg-stone-200"
                >
                  Pošalji upit
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
