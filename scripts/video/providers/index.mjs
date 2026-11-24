// Video provider interface. Every provider implements:
//   generate({ imagePath, prompt, shot, options }) -> Promise<job>
// job = { id, provider, status, manifestPath?, ... }
// No provider spends credits unless explicitly enabled through env + options.
import { dryRun } from "./dry-run.mjs";
import { localComfyui } from "./local-comfyui.mjs";
import { anonrouter } from "./anonrouter.mjs";

export const providers = { dry_run: dryRun, local_comfyui: localComfyui, anonrouter };

export function getProvider(name) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider "${name}". Known: ${Object.keys(providers).join(", ")}`);
  return p;
}

// Reference-frame constraints every AI shot must carry (see docs/shots/shot.schema.json).
export function assertReferenceConstraints(shot) {
  const r = shot?.reference_constraints;
  if (!r) throw new Error("shot.reference_constraints is required for AI image-to-video");
  if (!r.reference_image) throw new Error("reference_constraints.reference_image is required");
  if (!Array.isArray(r.locked_geometry) || r.locked_geometry.length === 0)
    throw new Error("reference_constraints.locked_geometry must list elements that must not change");
  if (!Array.isArray(r.negative) || r.negative.length === 0)
    throw new Error("reference_constraints.negative must list forbidden changes");
  return r;
}
