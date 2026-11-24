---
name: architectural-video-production
description: When to use a Blender render versus AI image-to-video for architecture, controlled image-to-video prompts and shot briefs, reference-frame constraints, negative requirements, visual consistency checks, and integration into HyperFrames compositions.
---

# Architectural video production

## INPUT
- A shot spec: `docs/shots/<id>.json` (schema `docs/shots/shot.schema.json`).
- A reference still: a Blender render from Agent A (`assets/blender/renders/`) or a placeholder under `video/assets/placeholder/`.
- Verified model IDs only, from `docs/video-model-selection.md`. No model ID is assumed.

## PROCEDURE
1. Decide the source. Use Blender deterministic camera for any shot showing real geometry: exteriors, facades, floor levels, interiors. Use AI image-to-video only for atmospheric or non-geometric plates (sky, ambient motion, people-free ground) and only when the reference image is a Blender still. Set `source.kind` accordingly.
2. Write a shot brief from the spec: purpose, camera path summary, duration, and the reference image path. Keep the brief in the shot JSON, not in ad hoc prompts.
3. Controlled image-to-video prompt: state camera motion in one sentence (for example "slow push-in, 3 seconds, camera does not roll"). Then list locked elements and forbidden changes.
4. Reference-frame constraints (required for `ai_image_to_video`): `reference_constraints.reference_image`, `locked_geometry` (at least one item, e.g. "building massing", "window grid", "horizon"), and `negative` (at least one item, e.g. "added or removed windows", "extra floors", "text or logos", "people in foreground").
5. Submit only through `scripts/video/providers/`. Start with `dry_run`, which writes a manifest and makes no network call. `anonrouter` and `local_comfyui` are disabled unless `VIDEO_ANONROUTER_ENABLED=1` or `VIDEO_LOCAL_COMFYUI=1` is set. Paid generation needs explicit user approval.
6. Integration: build the composition with `scripts/video/build-composition.mjs` from a template in `video/templates/` (`aerial-reveal`, `facade-flyby`, `architectural-transition`, `typography-title`). Plates go in `video/assets/` or `public/media/video/`. Lint with `npx hyperframes lint`, then render with `npx hyperframes render .` from `video/`.

## VALIDATION
- Manifest check: `node --test scripts/video/providers/provider.test.mjs` passes (5/5 at last run).
- Template check: `node --test scripts/video/build-composition.test.mjs` passes (2/2).
- Composition lint: `npx hyperframes lint` reports 0 errors and 0 warnings for every file in `video/compositions/`.
- Output check: `ffprobe` reports the expected codec, resolution, fps and duration.
- Consistency: compare the first frame of an AI clip with its reference still. Structural edges (window grid, roofline) must match within the tolerance in the shot spec. Any new architectural element is a failure.

## OUTPUT
- Shot JSON in `docs/shots/`.
- Manifest in `video/renders/manifests/` (dry run) or a provider job record.
- Composition in `video/compositions/`, and the rendered MP4 in `public/media/video/`.

## FAILURE RECOVERY
- Reference drift (AI adds or removes windows): switch the shot to `blender_deterministic` and re-render from Blender. Do not prompt around the drift.
- Reference image missing: stop the shot. Do not substitute a generated still.
- Provider disabled or unreachable: keep the `dry_run` manifest as evidence, report the blocker, and do not retry paid calls.
- Smoke check failure: re-run `video/` `npx hyperframes render .` with `--quiet` off to read the failing stage.
