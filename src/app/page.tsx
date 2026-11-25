import { Suspense } from "react";
import type { Metadata } from "next";
import { loadSelectorDataset } from "@/lib/mocire/load-selector-data";
import { MocireSelectorApp, type ViewMode } from "@/components/mocire/MocireSelectorApp";

export const metadata: Metadata = {
  title: "Močire Zadar H — Interaktivni 3D odabir stanova",
  description:
    "Interaktivni 3D pregled zgrade Močire Zadar H, tlocrti etaža i dostupnost svih 94 stanova.",
};

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

async function SelectorRouteContent({ searchParams }: HomeProps) {
  const query = await searchParams;
  const dataset = await loadSelectorDataset();
  const rawMode = firstParam(query.mode);
  const mode: ViewMode =
    rawMode === "3d" || rawMode === "plan3d" || rawMode === "plan2d" || rawMode === "photos"
      ? rawMode
      : "3d";

  const rawUnit = firstParam(query.unit);
  const matchedUnit = rawUnit
    ? dataset.units.find((u) => u.unit_id === rawUnit || u.slug === rawUnit)
    : undefined;

  const rawFloor = firstParam(query.floor);
  const floorId = matchedUnit
    ? matchedUnit.floor_id
    : rawFloor && dataset.floors.some((f) => f.floor_id === rawFloor)
      ? rawFloor
      : "L02";

  return (
    <MocireSelectorApp
      dataset={dataset}
      initial={{
        mode,
        floorId,
        unitId: matchedUnit?.unit_id ?? null,
      }}
    />
  );
}

export default function Home({ searchParams }: HomeProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-screen items-center justify-center bg-[#151412] text-sm text-stone-300">
          Učitavanje Močire Zadar H…
        </div>
      }
    >
      <SelectorRouteContent searchParams={searchParams} />
    </Suspense>
  );
}
