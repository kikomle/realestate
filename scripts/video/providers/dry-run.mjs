// dry_run: writes a manifest only. Makes no network call and spends nothing.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { assertReferenceConstraints } from "./index.mjs";

export const dryRun = {
  name: "dry_run",
  liveTested: true,
  async generate({ imagePath, prompt, shot, options = {} }) {
    if (!imagePath || !existsSync(imagePath)) throw new Error(`reference image not found: ${imagePath}`);
    const constraints = assertReferenceConstraints(shot);
    const id = `dry_${randomUUID().slice(0, 8)}`;
    const outDir = resolve(options.outDir ?? "video/renders/manifests");
    mkdirSync(outDir, { recursive: true });
    const manifestPath = join(outDir, `${id}.json`);
    const manifest = {
      id,
      provider: "dry_run",
      status: "dry_run_not_submitted",
      created_at: new Date().toISOString(),
      image_path: imagePath,
      prompt,
      shot_id: shot.id,
      duration_s: shot.duration_s,
      camera: shot.camera ?? null,
      reference_constraints: constraints,
      estimated_cost_usd: 0,
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return { id, provider: "dry_run", status: manifest.status, manifestPath };
  },
};
