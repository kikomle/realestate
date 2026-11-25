# Stage 3 private preview — exterior → floor registration proof

**Status: draft contract and handoff. Not a gate, not a release, not the Stage 4 selector.**

This document scopes a **PRE-GATE private proof** of the OVERVIEW step only: registering one
exterior image to a floor key and reviewing it locally. It is requested by the user and is
**not** the final app and **not** Stage 4. It does not pass GATE 2 or GATE 3 for the whole
selector. See [BUILD-PLAN.md](BUILD-PLAN.md), [workflow-gates.md](workflow-gates.md) and the
[progress log](../reports/progress.md).

Read the two governing inputs first: [Stage 2 source register](ASSET-SOURCES.md) and the
[Stage 2 verification report](../reports/qa/stage2/verification.md).

## Scope and non-goals

- **In scope:** a single private registration of one H exterior frame to a floor key, with a
  local QA page to review it by eye. Plan → unit registration already passed privately at Stage 2.
- **Out of scope:** the three-state visitor flow, the Stage 4 selection screen, any Next route or
  `/api` endpoint, the final OVERVIEW art choice, true 3D, AI generation, video.
- **Not commissioned:** there is no interior, walkthrough, film or paid generation job here
  ([BUILD-PLAN.md §Optional exterior 3D](BUILD-PLAN.md), [AGENTS.md](../AGENTS.md) rule 6).
- `/viewer` is a synthetic GLB sandbox and is unrelated to this proof.

### Stage 4 remains ahead

This proof only de-risks OVERVIEW. Stage 4 still needs the whole interface, and nothing here
builds it. What Stage 4 still requires, treated **as concept only, not implemented or verified**:

- **Approved pins:** owner-approved floor-band targets on an approved overview image. The Stage 3
  proof's `focus` state is provisional and unverified.
- **A documented final view and focus state:** which image version, crop and selected/hover focus
  the release OVERVIEW uses. Recorded here as a concept; not approved.

No Stage 4 screen exists and none is implied by this document.

## Source images (from Stage 2)

The eight H exteriors are local-only JPEGs `raw/stage2/exterior/Mocire_H-Zadar_000.jpg` …
`_007.jpg` ([ASSET-SOURCES.md](ASSET-SOURCES.md), [G2](../reports/gate2-source-rights.md)). No
release clearance exists for any of them.

For this proof:

| Role | Image | Intrinsic size | Note |
|---|---|---|---|
| Arrival frame | `Mocire_H-Zadar_001.jpg` — oblique | 1920×1080 | The arrival image; **no** floor map is registered to it. |
| Sole discretionary map | `Mocire_H-Zadar_000.jpg` — front | 1920×1080 | The only image that may receive a hypothetical image-space SVG floor map. |

The two carry the same intrinsic dimensions (1920×1080), so a shared `viewBox` and fit are
possible; the pixels still establish no architectural dimension
([BUILD-PLAN.md §Registering images](BUILD-PLAN.md)). `_000` is a front view and **not an
approved overview selection map** ([G2](../reports/gate2-source-rights.md),
[ASSET-SOURCES.md](ASSET-SOURCES.md)). Any polygons placed on `_000` are a hypothetical
image-space trace, to be reviewed and discarded, not approved coordinates. Do not import
third-party coordinates.

## Inputs and exact private paths

- Exterior originals: `assets/source/mocire-zadar-h/raw/stage2/exterior/Mocire_H-Zadar_000.jpg`
  and `..._001.jpg` (ignored by Git; see `.gitignore` `assets/source/**/raw/`).
- Floor list / viewBoxes / hashes: `src/data/floors.json`.
- Stage 2 plan → unit overlays (private): `assets/geometry/stage2/private/overlays/*.svg`.
- Provenance: `assets/source/mocire-zadar-h/stage2-manifest.json` via [ASSET-SOURCES.md](ASSET-SOURCES.md).

Both the raw-exterior directory and the Stage 3 output directory are Git-ignored. No unapproved
asset is exposed or promoted to `public/`.

## Floor source and API contract

The floor list is the canonical set already used by the private plan maps. It comes from
`src/data/floors.json`: **L00, L01, L02, L03, L04**, with `unit_ids` per floor. The floor route
parameter (`?floor=L02`) validates against that list; the same 21 L04 units on the gallery plan do
**not** add a sixth floor — the gallery belongs to L04 as a second `plans[]` variant
([floors.json](../src/data/floors.json), [BUILD-PLAN.md](BUILD-PLAN.md)).

Planned behaviour, contingent on review (see "Evidence" below):

- `?floor=L02` selects Etaža 2 for the map; an unknown or empty `floor` is an explicit invalid state.
- **L00 is intended list-only:** no floor band is registered to the ground floor in this proof; it
  stays reachable through the text list.
- `focus`, when a control activates, is a **planned** state recorded as provisional and
  **not verified**.

## Draft registration contract

Draft JSON only — not yet produced, not yet reviewed. Coordinates are **native image pixels**,
`x` right, `y` down, matching `src/data/floors.json` `coordinate_system`; no crop. Planned private
path: `assets/geometry/stage2/private/stage3-exterior/registration.json` (filename exactly as
requested; Git-ignored via `assets/geometry/stage2/private/` in `.gitignore`).

| Field | Meaning |
|---|---|
| `image_id` | Identifier of the exterior version, e.g. `H-exterior-000`. |
| `source_sha256` | SHA-256 of the exact exterior bytes registered. |
| `width_px`, `height_px` | Intrinsic pixel dimensions; `1920`, `1080`. |
| `viewBox` | SVG `viewBox`, e.g. `0 0 1920 1080`. |
| `crop` | Shared fit/crop applied to art **and** overlay, e.g. `"none"`. |
| `status` | Record state, e.g. `draft` / `provisional`. |
| `floors[]` | Floor entries: `floor_id`, `status`, `polygons`, `focus`, `note`. |
| `floors[].floor_id` | Canonical floor id from `src/data/floors.json` (`L00`…`L04`). |
| `floors[].status` | Per-floor state, e.g. `registered` / `list-only`. |
| `floors[].polygons` | Image-space rings in native pixels (hypothetical on `_000`). |
| `floors[].focus` | Planned, provisional, not verified. |
| `floors[].note` | Free note (e.g. list-only reason, trace caveat). |
| `floors[].plans[]` | **Future**: per-floor plan → unit association, as already present in `floors.json`. |

Skeleton, unverified and with no polygons authored:

```json
{
  "image_id": "H-exterior-000",
  "source_sha256": "<sha256 of Mocire_H-Zadar_000.jpg>",
  "width_px": 1920,
  "height_px": 1080,
  "viewBox": "0 0 1920 1080",
  "crop": "none",
  "status": "draft",
  "floors": [
    { "floor_id": "L00", "status": "list-only", "polygons": [], "focus": null, "note": "no band registered; text list only" },
    { "floor_id": "L01", "status": "draft", "polygons": [], "focus": null, "note": "hypothetical trace on front view; not verified" },
    { "floor_id": "L02", "status": "draft", "polygons": [], "focus": null, "note": "" },
    { "floor_id": "L03", "status": "draft", "polygons": [], "focus": null, "note": "" },
    { "floor_id": "L04", "status": "draft", "polygons": [], "focus": null, "note": "" }
  ]
}
```

`floors[].plans[]` is the reserved slot for the future per-floor plan association. It mirrors the
`plans[]` array already in [floors.json](../src/data/floors.json) (`image_id`, `sha256`,
`width_px`, `height_px`, `viewBox`, `private_overlay`, …) and is left empty here.

## Evidence (planned)

- HTML QA report: `reports/qa/stage3-exterior-proof.html`, served through the parent process
  **loopback only** (e.g. `127.0.0.1`); never published, never in `public/`.
- Registration data: `assets/geometry/stage2/private/stage3-exterior/registration.json`
  (Git-ignored).

Both are **planned outputs**. They do not exist yet, so no runtime, alignment or coverage check is
claimed here. Any claim that the map "works" is contingent on the QA report existing and being
reviewed against the exact image hash at 1440×900 and 390×844.

## What the owner must clear for the real app

This proof cannot, by itself, clear the selector. To move the real app forward the integration
owner still needs, per [GATES 2–3](workflow-gates.md) and the [progress handoff](../reports/progress.md):

1. A clearly identified **H exterior still with a legible floor key** and its corresponding
   **approved floor-band key** — the `_000` front view has no approved key.
2. **Separate permissions** for displaying the art and for using the registration data (or an owner
   instruction to register anew), covering both local proof and release.
3. Confirmation that no unapproved artifact has entered `public/`, bundles or network requests.

Until then **GATE 2 and GATE 3 stay open for the whole selector**: there is no floor key and no
release rights for art or registration.

## Contingency

Runtime claims here are contingent on the planned QA report and registration JSON. This document
makes no claim that tests pass, that anything is approved or released, or that a finished Next
route exists. Any anchor/`?floor=L02` behaviour is a draft contract to review, not a delivered route.

## Follow-up: open the interactive floor plan

Run `node scripts/web/serve-stage3-preview.mjs 4175` and open
[the private floor review](http://127.0.0.1:4175/plan-review) with
`npm run dev:exterior` running on port 3103. Click a provisional band or choose a floor from
the list. **Prilaz** is the default; its **Odaberite etažu** panel sits over the angled photo
and opens any of the five main plans with a zoom-in reveal. **Pročelje** keeps the registered
front still and its provisional bands; a band click zooms toward that region before revealing
the exact, hash-pinned plan. The obscured ground floor stays on the list, and the angled photo
has no floor hitboxes.
Reduced motion and unavailable transition art keep the direct plan navigation.
Browser Back and the in-page return link return to the
view that opened the plan, including after switching floors, opening the gallery, or viewing an
apartment. Use port 4175 for this linked review. The estimated bands remain isolated here; the
transition does not register them in the Next.js selector or grant release approval.

Both views open any floor from **Popis etaža**. In the Next.js preview,
**Zumiraj etaže** opens this separate review at **Prilaz**. Older plan links from **Pregled**
also return to **Prilaz**.

`npx --no-install playwright test -c tests/web/facade-plan-journey.config.ts --workers=2`
passed **28 checks**. It covers the two-tab switch, all five floor buttons on **Prilaz**, the
available front bands, the moving camera, exact decoded plans, reduced motion, unavailable
transition art and returning to select another floor on desktop and mobile.
