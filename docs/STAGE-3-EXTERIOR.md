# Stage 3 · Private exterior explorer

## Asset and interaction contract

This is a development-only integration of the exterior step. It does not replace the homepage, change `/viewer`, or pass Gate 3. Keep the earlier [exterior registration proof](STAGE-3-PRIVATE-PREVIEW.md) separate from this preview.

- **Arrival:** Sigma `Mocire_H-Zadar_001`, an oblique establishing view. **Façade:** Sigma `Mocire_H-Zadar_000`, the frontal view for reviewing storey positions. Use the original 1920 × 1080 framing and hash-pinned, uncropped AVIF/WebP derivatives from the existing local manifest (960/1280/1920). Transitions are 2D pan/zoom and a dissolve between two stills, not a 3D flight.
- **Coordinates:** any future floor ring and focal point belong to exactly one image ID and source hash; use normalized image coordinates (0–1, top-left origin). Image and SVG must occupy the same native plane and share one transform, with no independent crop. Do not import the earlier provisional traces as selectable geometry.
- **Floor identity:** `src/data/floors.json` is canonical. On **Pregled**, all five floor links go directly to their private interactive plans, including without JavaScript. On **Pročelje**, `selectFloor(id)` still selects by text and writes `?floor=<id>`; no guessed endpoint for a text-only floor. `?view=facade` is unselected building focus; no parameter is overview. `Back`, `Forward`, and refresh restore the same addressable state. Hover and free pan/zoom are transient.
- **Handoff:** `getFloorHandoff` describes the floor and plan references; it must reject proceeding until the same selected floor has an approved registration and a settled camera on that view. A separate, explicitly labelled **Provjeri tlocrt** link opens the [private floor-plan proof](../reports/qa/stage4-plan-proof.md); it is not the guarded handoff.

## Run locally

With the Stage 2 source snapshot present, rebuild the private image ladder if needed:

```sh
.venv/bin/python scripts/source/prepare_stage3_exterior.py
.venv/bin/python scripts/validate/check_stage3_exterior.py
npm run dev:exterior
```

Open `http://127.0.0.1:3103/exterior-preview`. The dedicated server binds to loopback and isolates its Next build output. Normal `next dev` and production do not enable the preview. Do not tunnel or deploy this preview. `/exterior-preview/media/` allowlists and checksums only the twelve exterior derivatives; no originals, plans, or provisional SVGs are exposed through it.

## Floor coverage and Stage 4 boundary

The [asset audit](../assets/geometry/stage3/exterior-audit.md) found no annotated exterior or section tying render bands to the canonical floor IDs. The earlier `_000` proof has four provisional floor identities (L01–L04); L00 is substantially occluded. **Five floor records are verified as source records; zero verified façade targets are available.** The explorer retains every floor as a text-only selection, leaves the building view unaltered by that selection, and indicates the missing registration. Do not treat the prior proof's hover or selection screenshots as verified targets.

`src/components/exterior-preview/selection.ts` exposes `getFloorHandoff(floor, viewId, registration?, settled?)` and `openSelectedFloorPlan(handoff, open)`. A ready handoff contains `floorId`, `label`, `viewId`, the registered image hash and normalized rings/target/zoom, a viewport-relative endpoint (`x`, `y`, `scale`, `viewportWidth`, `viewportHeight`), the canonical floor URL, and plan image IDs/variants/hashes from `src/data/floors.json`. The caller supplies a settled snapshot tagged with the same floor and image version. `openSelectedFloorPlan` calls a Stage 4 action only if this contract is ready; the current preview intentionally returns `NO_VERIFIED_EXTERIOR_REGISTRATION` with a null endpoint for each floor.

Remaining dependencies: owner-confirmed exterior floor key or reviewed registration for an approved still; approval for any text-only occlusion exception; separate clearance of art and registration for release. The integrated Stage 4 transition still needs to consume the verified viewport handoff. The private proof uses a distinct URL, without a level zoom, cross-view animation, or apartment detail screen.

The direct overview links passed six selector checks and two JavaScript-off checks on desktop and
portrait Chromium. Run `npx --no-install playwright test -c tests/web/stage6-selector.config.ts --workers=1 --grep 'Pregled links directly|exterior list L02|all imagery and WebGL'`
and `npx --no-install playwright test -c tests/web/exterior-explorer.config.ts --project=desktop --project=portrait --workers=1 --grep 'without client scripts'`.
