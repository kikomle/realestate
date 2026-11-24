# Močire H · Stage 6 follow-up QA

**Scope:** loopback private preview only. [Open the exterior](http://127.0.0.1:3103/exterior-preview), or [open H 4.5 on the L04 gallery](http://127.0.0.1:3103/exterior-preview/plans?floor=L04&plan=gallery&unit=H+4.5). If needed, start it with `npm run dev:exterior`. The earlier [Stage 6 checkpoint](stage6-private-quality.md) remains separate evidence.

## Changes

- Refined the exterior headline and project mark, made the headline visible on tall portrait screens, and improved floor and apartment typography. The dark pine apartment summary separates sourced facts from the original plan. The geometry, crop, and floor drawing are unchanged.
- The forward shot and explicit return now frame a footprint larger than the visible aperture by temporarily pulling back. The resting drawing size, selection history and reduced-motion behavior are unchanged. This fixes H 0.4 in native-size mode on mobile.
- Removed the decorative façade thumbnail from apartment detail. The text link still opens the corresponding exterior floor selection and works without JavaScript. The existing arrival and façade stills, AVIF/WebP fallbacks and native lossless drawings remain in use.
- The visual and media subagents returned read-only recommendations after tool permissions blocked their local edits and browser runs. An independent motion review identified the clipping bug. The integration owner implemented those recommendations and checked the running site rather than treating review notes as passing tests.

## Source coverage

| Group | Unique apartments | Registered plan outlines |
|---|---:|---:|
| L00 · Prizemlje | 16 | 16 |
| L01 · Etaža 1 | 19 | 19 |
| L02 · Etaža 2 | 19 | 19 |
| L03 · Etaža 3 | 19 | 19 |
| L04 · Etaža 4, main and gallery | 21 | 42 |
| **Total** | **94** | **115** |

The gallery is a sixth drawing for the same 21 L04 apartments, not a new floor. `.venv/bin/python scripts/validate/check_mocire_stage2.py` verified the 94 listing/detail/PDF joins and 115 polygons, with zero missing, invalid, wrong-floor, duplicate, overlapping or out-of-bounds polygons. The data retains 13 NKP and 15 NP discrepancies as separate input values. `check_ground_sheet_locators.py` passed for all 16 ground-floor apartments. `check_stage3_exterior.py` verified both active exterior renders and all 12 derivatives. The diagnostic exterior rings it lists were not integrated. [Source check output](stage2/private/stage6-final/source-validation.log)

## Live and targeted browser checks

- `npx --no-install playwright test -c tests/web/stage6-selector.config.ts --workers=2`: **258 passed** in 9 minutes, with WebGL disabled. All **94 main apartment URLs and 21 gallery URLs** resolved from a fresh page on both desktop and portrait, displayed the exact ID, listing area and original individual plan, highlighted the correct outline and card, and returned to the matching floor-plan variant. Each viewport also passed all five exterior-list entrances and returns, invalid-address recovery, Back/Forward, missing imagery, loaded-gallery offline fallback, and JavaScript-off navigation. [Full browser output](stage2/private/stage6-final/browser-normal.log)
- `node scripts/validate/capture-mocire-selector.mjs` passed on desktop and portrait touch with WebGL disabled. It selected L04 from the actual exterior, opened the gallery and H 4.5 and checked **91,05 m²**, the decoded individual plan, zoom/reset, Back/Forward, focus restoration, and the text façade link with decorative media blocked. No console errors occurred in the normal journeys. The same command verified that the 44 px plan-entry link remained in view and the resolved apartment did not overflow horizontally at **320×568**, **844×390**, and **1920×1080**. [Capture output](stage2/private/stage6-final/capture-final.log)
- `npx --no-install playwright test -c tests/web/apartment-detail.config.ts --workers=1 --grep 'oversized native|explicit return retraces|browser history can interrupt|without JavaScript'`: **7 passed**, one desktop-only skip for the portrait framing case. H 0.4 fits the narrow aperture in both directions; browser Back and a live reduced-motion change leave no stale transform or selection; the façade link is usable without JavaScript. An earlier return test could inspect the transient art after it settled under host load. The rerun samples the actual first return frame in the browser instead. [Regression output](stage2/private/stage6-final/lane-b-c-retry.log)
- `PW_REDUCED_MOTION=1 npx --no-install playwright test -c tests/web/stage6-selector.config.ts --workers=1 --grep 'exterior list L02|exterior list L04|reduced motion selection|cold .* H 0\.14 resolves|cold .* H 4\.5 resolves'`: **12 passed**. Both viewports covered the L02 and L04 list journeys, H 0.14 and both H 4.5 addresses, motion bypass, and focus through history. This was a targeted smoke run, not an exhaustive reduced-motion cold matrix. [Reduced-motion output](stage2/private/stage6-final/browser-reduced.log)
- `npx --no-install playwright test -c tests/web/exterior-explorer.config.ts --workers=1 --grep 'allowlisted WebP fallback|both image formats are unavailable'`: **8 passed** across desktop, laptop, portrait and landscape. The verification covered WebP fallback and a usable floor list when both image formats failed. [Media fallback output](stage2/private/stage6-final/media-fallback.log)
- A 390×844 Chromium forced-colors probe verified the selected-floor outline and restored keyboard focus after Back. The post-hydration test waits for the interactive plan to be ready; before hydration, the same unit link navigates as a normal document link.

## Private screenshots

| Shot | Desktop · 1440×900 | Mobile · 390×844 |
|---|---|---|
| Exterior arrival | [PNG](stage2/private/stage6-final/screens/desktop-01-arrival.png) | [PNG](stage2/private/stage6-final/screens/mobile-01-arrival.png) |
| Exterior with L04 selected | [PNG](stage2/private/stage6-final/screens/desktop-02-floor-selected.png) | [PNG](stage2/private/stage6-final/screens/mobile-02-floor-selected.png) |
| L04 gallery floor plan | [PNG](stage2/private/stage6-final/screens/desktop-03-gallery-floor-plan.png) | [PNG](stage2/private/stage6-final/screens/mobile-03-gallery-floor-plan.png) |
| H 4.5 and its individual plan | [PNG](stage2/private/stage6-final/screens/desktop-04-apartment.png) | [PNG](stage2/private/stage6-final/screens/mobile-04-apartment.png) |

All eight captures were inspected. The two exterior views leave the still visible without suggesting a verified façade target. The floor art and outlines follow the same crop; the default readable plan is horizontally scrollable on portrait. Both halves of the duplex fit in the individual plan. The captures stay Git-ignored because they contain private source art.

## Accessibility and media

- `node scripts/validate/audit-mocire-accessibility.mjs`: zero definite axe violations in eight state/viewport combinations. Axe flagged contrast for manual review on the exterior story and loading message. The desktop story’s text against its lightest possible composited background is **10.41:1**; the mobile story’s is **11.70:1**; the loading message’s is **15.27:1**. This is not a manual screen-reader or cross-browser certification. [Axe output](stage2/private/stage6-final/axe.jsonl)
- In a fresh desktop Chromium context, scrolling to the old H 4.5 façade card requested a **41,835-byte** AVIF. When blocked, it still showed an image box with zero intrinsic width. The card is now text-only; the exact return address remains reachable and the apartment drawing still loads. This saving applies when the old lazy thumbnail would have been requested.
- The preview uses two pre-rendered Sigma stills and source plan images; it does not need a GLB, video or WebGL. No synthetic assets were added.
- In local Chromium, a median of three cold visits observed the arrival AVIF decoded by **0.74–0.90 s** and the L02 floor plan by **0.81–2.96 s** across the two sizes. A sampled H 2.1 transition reached the apartment state in **672 ms** with a **16.7–16.8 ms** p95 frame gap; reduced motion skipped the zoom and reached it in **34–38 ms**. The active arrival AVIF was **114.1 KiB**, L02’s exact floor plan **210.7 KiB**, and H 2.1’s individual drawing **74.9 KiB**. These are local timings under host load, not production Web Vitals or mobile-network measurements. [Profile](stage2/private/stage6-final/profile-final.json)

## Production and release decision

`npm run lint`, `npm run test` (**33 passed**), `npm run build` (Next.js **16.4.6**, compiled), `npm run typecheck`, and `git diff --check` exited 0. Against a separate `next start` with the preview flag deliberately set, `node tests/web/stage6-production-audit.mjs` found `/` **200**, all **252** private-path probes **404**, no private dependencies in **12** traced manifests, and no known private values or file hashes in scanned public/client or server output. [Build output](stage2/private/stage6-final/build.log) · [Audit](stage2/private/stage6-final/production-audit.json)

**Release gates remain open.** An owner-approved floor key is needed for an exterior-floor hotspot or level-specific zoom, and public-use permission is needed for the art and registrations. All five floors remain available by list in the private preview. Production containment is not a release of the selector. Availability is the **23 November 2026** snapshot, not a live sales feed.
