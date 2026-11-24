import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { localPreviewEnabled } from "./local-access";

const inventories = {
  floors: "src/data/floors.json",
  apartments: "src/data/apartments.json",
} as const;

/** Do not statically import local inventories into a production server chunk. */
export async function readPreviewInventory<T>(kind: keyof typeof inventories): Promise<T | null> {
  if (!localPreviewEnabled()) return null;
  try {
    const input = await readFile(join(/* turbopackIgnore: true */ process.cwd(), inventories[kind]), "utf8");
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}
