"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExteriorPhoto } from "@/lib/mocire/types";

export function ExteriorPhotoGallery({ photos }: { photos: readonly ExteriorPhoto[] }) {
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? photos[0];
  if (!current) return null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#151412] p-6 pt-20 pb-28">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.image_url}
          alt={current.label}
          width={current.width}
          height={current.height}
          className="block max-h-[65vh] w-full object-contain"
        />

        <div className="absolute top-3 left-3 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-xs font-medium text-stone-100 backdrop-blur-md">
          {current.label} · Sigma izvorna vizualizacija ({index + 1}/{photos.length})
        </div>

        <button
          type="button"
          aria-label="Prethodna fotografija"
          onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
          className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-white/20 bg-black/65 p-2.5 text-white backdrop-blur-md transition hover:bg-black/85"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Sljedeća fotografija"
          onClick={() => setIndex((i) => (i + 1) % photos.length)}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-white/20 bg-black/65 p-2.5 text-white backdrop-blur-md transition hover:bg-black/85"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mt-4 flex max-w-5xl gap-2 overflow-x-auto pb-1">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setIndex(idx)}
            className={`group relative shrink-0 overflow-hidden rounded-lg border transition ${
              idx === index
                ? "border-amber-300 ring-2 ring-amber-300/40"
                : "border-white/15 opacity-70 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.image_url}
              alt={photo.label}
              className="h-14 w-24 object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[10px] text-stone-200 truncate">
              {photo.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
