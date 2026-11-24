# Workflow gates — Močire Zadar H

Run these gates **in order**. `reports/progress.md` is the integration owner's decision log. A pass needs the evidence file, exact checks and their output, the inputs reviewed, and a verdict for the stated scope (local prototype or release). Link actual files and record IDs; a proposed report or test is not evidence.

**Do not build the final building experience before GATE 3 passes.** Before then, inventory sources and review overlays on private registration proofs. The proposed visitor flow is OVERVIEW (exterior still with floor SVG) → FLOOR (2D plan with unit SVG) → APARTMENT (sourced details). `/viewer` is a synthetic sandbox. Metric geometry, a GLB, video and an FPS target are not prerequisites for any gate.

## GATE 1 — Web baseline

- **Requires:** the existing scaffold, `package.json` and `package-lock.json`; install dependencies with `npm ci` if needed.
- **Check:** from the root run `npm run lint && npm run typecheck && npm run test && npm run build`. All four must exit 0. This checks the scaffold, not the proposed selection flow.
- **Evidence:** `reports/progress.md`, with the four results and build route output. Root Playwright has a separate configuration blocker (see `docs/runbook.md`); neither E2E nor the full-machine doctor is a GATE 1 criterion.

## GATE 2 — Source & rights

- **Requires GATE 1.** Declare the stage, building, levels, units and images in scope. Start with `assets/source/mocire-zadar-h/inventory.json`, its files and provenance sidecars under `assets/source/mocire-zadar-h/raw/`, and `assets/geometry/apartments.json`. `docs/source-inventory.md` explains the source limits.
- **Check the inputs:** open the actual Močire H exterior intended for OVERVIEW and each scoped plan. Record local path, version/hash, intrinsic size, source URL/owner and retrieval date. A remote gallery candidate, construction photo, generic placeholder or synthetic building does not satisfy the exterior requirement. If usable exterior art is missing, this gate is blocked.
- **Check the rights:** for each image and its matching map, record separately who permits display of the art and who permits use of the registration data, for which stage, with a resolvable evidence reference. Local-only material can support a private proof; public release requires explicit clearance. Unknown rights do not authorize use. Do not copy Sigma's image-map coordinates. Request approved matching art and map (or permission for a new registration). Keep raw sources private.
- **Check the data:** join each scoped `{level, unit_id, source_ref}` to its floor and detail URL in the local inventory; check every field proposed for display against that record. Preserve nulls and missing-source flags. Status is a dated snapshot; “Obračunska površina” is the published listing area, not a verified gross or net measurement.
- **Evidence:** produce `reports/gate2-source-rights.md`: scoped input ledger, join counts and mismatches, per-asset local/release decisions, outstanding permissions and reviewer. Use file/hash and inventory checks plus documented rights review; a combined validator is **planned**, not an existing command.

## GATE 3 — Overlay geometry

- **Requires GATE 2** for the same scope and intended use. Deliver two image-space registrations in `assets/geometry/`: exterior → sourced levels, and each scoped floor-plan image → sourced units on that level. Each record identifies the exact image version, native dimensions, SVG `viewBox`/crop and target. Key by `{image, level}` for floors and `{image, level, unit_id}` for units. A gallery image sharing L04 unit IDs needs its own map.
- **Check coverage per image:** compare expected keys from the GATE 2 ledger with registrations and approved exceptions. Require zero unexplained missing, invalid or duplicate entries; reject orphan/wrong-level targets, out-of-bounds or degenerate shapes and mismatched image versions. An exception names the exact key, reason, approver and reachable list-only target. Do not guess or auto-clip polygons. A list-only exception cannot waive an entire registration tier.
- **Check alignment:** review both levels over the actual Močire H images at 1440×900 and 390×844. Art and SVG must share the same fit/crop/scale, and each control must land on its intended floor or unit. Review each image separately; changing the crop or source invalidates its registration. A synthetic proof or another development's map cannot stand in for Močire.
- **Evidence:** produce `reports/gate3-overlay-geometry.md` with exact registration paths and image IDs/hashes, expected vs. actual counts **per image**, exception decisions and private desktop/mobile proof references. The overlay validator is **planned**; document reproducible comparisons and visual sign-off. The existing metric validator does not check overlays.

## GATE 4 — Selection flow

- **Requires GATE 3.** Implement the three states in Next.js with accessible SVG controls and equivalent text links; GSAP is presentation only. Show only the APARTMENT fields justified by its source. The proposed URLs and invalid-state behavior are specified in `docs/BUILD-PLAN.md`.
- **Check:** open a valid apartment URL cold, navigate all three states by pointer and keyboard, and exercise Back/Forward. Verify the same floor/unit via the text list with imagery unavailable. Check accessible names, focus and reading order, mismatched and missing IDs, dated status and absent details. Compare the selected unit's ID and facts to its source record. Run the four GATE 1 commands on the changed app.
- **Evidence:** produce `reports/qa/gate4-selection-flow.md` with tested URLs, expected IDs, observed state, command output and trace/screenshot references. The private selector has its own Playwright suites (see [runbook](runbook.md#4-browser-checks-for-the-private-selector)). The root `npm run test:e2e` runner discovers `/viewer` sandbox tests and is not selector evidence.

## GATE 5 — Release assets & data

- **Requires GATE 4.** Produce a local release manifest mapping every proposed public image, overlay and displayed dataset to its version, source/approval and release destination. A local prototype decision does not transfer to release. Use only first-party or expressly approved release assets; keep source drawings and unapproved coordinates out of `public/`, bundles and network requests.
- **Check:** reconcile the release build's emitted and requested assets with that manifest; verify release permissions for both art and map. Recheck the scope, source joins, labels, as-of dates, flagged nulls and approved textual fallbacks. If release art, crop, map or coverage differs from the reviewed version, re-open GATES 2–4 for the affected images before promotion.
- **Evidence:** produce `reports/gate5-release-assets-data.md` with the exact manifest path, release file IDs/hashes, data audit output and rights decisions. A release audit script is **planned**; a successful `npm run build` alone does not establish rights or data correctness.

## GATE 6 — Quality

- **Requires GATE 5.** Run the GATE 1 checks on the release candidate. On desktop (1440×900) and mobile (390×844), exercise the released selection flow, including text-only navigation, focus/keyboard and screen-reader use, history/deep links, reduced motion, missing imagery and WebGL unavailable. Confirm the SVG targets still align and no browser errors occur.
- **Check:** run the selector specs against the release candidate in standard and reduced-motion modes; record which specs and projects actually ran. Supplement with manual assistive-technology and alignment review. Require no open CRITICAL or HIGH findings; record remaining findings with owners. Private dev results are useful regression evidence but do not satisfy this release gate.
- **Evidence:** produce `reports/qa/gate6-quality.md` with release version, results per device/mode, browser diagnostics, exact artifact paths and severity-ranked findings. Record the decision in `reports/progress.md`. The old 3D visual skill applies only to separate `/viewer` sandbox tests.
