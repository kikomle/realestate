---
name: cinematic-camera-direction
description: Camera paths for architectural reveals (aerial-to-building, building-to-floor, floor-to-apartment) with easing, focal length, framing, continuity and transitions. Prefer deterministic 3D camera animation for geometry-sensitive shots.
---

# Cinematic camera direction (architecture)

## INPUT
- Shot id and purpose, from `docs/shots/<id>.json` (schema: `docs/shots/shot.schema.json`).
- Site coordinates in meters, origin = south-west ground corner, X east, Y north, Z up.
- Calibrated geometry only: `assets/geometry/` JSON. Any value without a source is `null` with `geometry_status` `MISSING_SOURCE` or `UNKNOWN`. Never invent a floor height, eye height beyond the 1.5–1.6 m standard, or unit dimensions.

## PROCEDURE
1. Pick the shot path in the chain: `aerial-reveal` → `facade-flyby` → `floor-level-reveal` → `apartment-walkthrough`. Each shot's `continuity.exit_to` must equal the next shot's id.
2. Write keyframes as `{t, position_m, look_at_m, fov_deg}` (`t` in seconds). Compute `fov_deg` from focal length on a 36 mm full-frame sensor: `fov = 2·atan(18/f)`. Examples: 24 mm → 73.7°, 35 mm → 54.4°.
3. Choose focal length by role:
   - aerial / crane: 24 mm.
   - facade / flyby: 35 mm (keeps window grid undistorted).
   - interior: 24 mm (room depth), never wider than 24 mm.
4. Easing: `power2.inOut` for crane moves, `sine.inOut` for lateral dolly, `power1.inOut` for interior dolly. No ease on the wipe-based transitions except `power2.inOut`.
5. Framing: `horizon_rule: level` for every architectural shot. Keep at least `safe_margin_pct` free at the frame edges.
6. Prefer Blender deterministic camera (`source.kind: blender_deterministic`) for any shot where a building edge must line up with the plan. Use `ai_image_to_video` only for atmospheric plates, never as the geometry source.
7. Continuity: keep the camera heading at a shot's exit within 5° of the next shot's entry. Keep eye height constant during lateral moves.

## VALIDATION
- `node -e` or `python3 -c` JSON-schema validation of every shot against `docs/shots/shot.schema.json` (run with `jsonschema`): all 5 examples must report `VALID`.
- Any `null` coordinate has `geometry_status` `MISSING_SOURCE` or `UNKNOWN`.
- Camera never intersects a wall solid or comes within 3 m of a facade plane (geometry check once `assets/geometry/` exists).
- Horizon lines stay level within 0.5° in the rendered frame.

## OUTPUT
- Updated shot JSON in `docs/shots/`.
- Composition built from `video/templates/aerial-reveal.html`, `facade-flyby.html`, `architectural-transition.html` via `scripts/video/build-composition.mjs`, written to `video/compositions/`.

## FAILURE RECOVERY
- Missing geometry (floor height, unit wall positions): keep `null`, set `geometry_status: MISSING_SOURCE`, and do not render that shot. Report it to the orchestrator.
- Schema fails: fix the field the error names. Do not loosen the schema except for null coordinates flagged as above.
- A lint warning about duplicate media: give the two plates distinct sources (see `video/assets/placeholder/` for two different files).
