import { readFile } from "node:fs/promises";
import { join } from "node:path";

const HEADERS = {
  "Cache-Control": "private, max-age=3600",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

type FloorPlanEntry = {
  image_id: string;
  private_plan: string;
};

type Stage2Asset = {
  kind: string;
  unit_id: string | null;
  optimized?: { path: string };
};

let cachedPlanMap: Map<string, string> | null = null;
let cachedUnitMap: Map<string, string> | null = null;

async function getPlanMap(): Promise<Map<string, string>> {
  if (cachedPlanMap) return cachedPlanMap;
  const raw = await readFile(join(/* turbopackIgnore: true */ process.cwd(), "src/data/floors.json"), "utf8");
  const doc = JSON.parse(raw) as { floors: { plans: FloorPlanEntry[] }[] };
  const map = new Map<string, string>();
  for (const floor of doc.floors) {
    for (const plan of floor.plans) {
      map.set(plan.image_id, plan.private_plan);
    }
  }
  cachedPlanMap = map;
  return map;
}

async function getUnitMap(): Promise<Map<string, string>> {
  if (cachedUnitMap) return cachedUnitMap;
  const raw = await readFile(
    join(/* turbopackIgnore: true */ process.cwd(), "assets/source/mocire-zadar-h/stage2-manifest.json"),
    "utf8",
  );
  const doc = JSON.parse(raw) as { assets: Stage2Asset[] };
  const map = new Map<string, string>();
  for (const asset of doc.assets) {
    if (asset.kind === "unit-plan" && asset.unit_id && asset.optimized?.path) {
      const slug = asset.unit_id.replace(/\s+/g, "-");
      map.set(slug, `assets/source/mocire-zadar-h/${asset.optimized.path}`);
    }
  }
  cachedUnitMap = map;
  return map;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const cwd = /* turbopackIgnore: true */ process.cwd();

  try {
    if (kind === "exterior") {
      if (!/^00[0-7]$/.test(id)) {
        return new Response(null, { status: 404, headers: HEADERS });
      }
      const bytes = await readFile(
        join(cwd, `assets/source/mocire-zadar-h/raw/stage2/exterior/Mocire_H-Zadar_${id}.jpg`),
      );
      return new Response(new Uint8Array(bytes), {
        headers: { ...HEADERS, "Content-Type": "image/jpeg", "Content-Length": String(bytes.length) },
      });
    }

    if (kind === "plan") {
      if (!/^L0[0-4](-gallery)?$/.test(id)) {
        return new Response(null, { status: 404, headers: HEADERS });
      }
      const rel = (await getPlanMap()).get(id);
      if (!rel) return new Response(null, { status: 404, headers: HEADERS });
      const bytes = await readFile(join(cwd, rel));
      return new Response(new Uint8Array(bytes), {
        headers: { ...HEADERS, "Content-Type": "image/webp", "Content-Length": String(bytes.length) },
      });
    }

    if (kind === "unit") {
      if (!/^H-[0-4]\.\d{1,2}$/.test(id)) {
        return new Response(null, { status: 404, headers: HEADERS });
      }
      const rel = (await getUnitMap()).get(id);
      if (!rel) return new Response(null, { status: 404, headers: HEADERS });
      const bytes = await readFile(join(cwd, rel));
      return new Response(new Uint8Array(bytes), {
        headers: { ...HEADERS, "Content-Type": "image/webp", "Content-Length": String(bytes.length) },
      });
    }

    return new Response(null, { status: 404, headers: HEADERS });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return new Response(null, { status: code === "ENOENT" ? 404 : 500, headers: HEADERS });
  }
}
