import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ApartmentInventory, FloorInventory } from "../../src/lib/exterior-preview/inventory-types";

function readFixture<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
  } catch (cause) {
    throw new Error(`Cannot load the private preview fixture ${path}. See README.md for local inputs.`, { cause });
  }
}

export const readTestFloors = () => readFixture<FloorInventory>("src/data/floors.json");
export const readTestApartments = () => readFixture<ApartmentInventory>("src/data/apartments.json");

type LedgerAsset = {
  kind: string;
  unit_id: string | null;
  width: number;
  height: number;
  optimized?: { sha256: string };
};

export const readTestLedger = () =>
  readFixture<{ assets: LedgerAsset[] }>("assets/source/mocire-zadar-h/stage2-manifest.json");

type Witness = { id: string; points: [string | null, number, number][] };

export async function readPlanWitnesses(): Promise<Witness[]> {
  const path = "scripts/validate/stage2-plan-witnesses.mjs";
  try {
    const moduleUrl = pathToFileURL(resolve(path)).href;
    return (await import(moduleUrl)).plans;
  } catch (cause) {
    throw new Error(`Cannot load the private review points ${path}. See README.md for local inputs.`, { cause });
  }
}
