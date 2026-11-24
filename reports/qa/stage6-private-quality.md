# Močire H · Stage 6 private preview

**24 November 2026.** This is a review of the loopback preview, not a release or gate sign-off. Run `npm run dev:exterior` and open [the exterior](http://127.0.0.1:3103/exterior-preview), or open [H 4.5 on the L04 gallery](http://127.0.0.1:3103/exterior-preview/plans?floor=L04&plan=gallery&unit=H+4.5).

## What changed

- The exterior, floor drawings and detail view share a quieter palette, stronger text backdrops, touch-sized controls and clearer focus. Real Sigma renders `_001` and `_000` remain the two exterior views. No new imagery, video or 3D was added.
- The registered floor outline holds briefly, then the image and SVG travel together before the individual plan is revealed. The explicit return retraces the same footprint, including on the L04 gallery. Browser history commits the destination immediately; rapid input, resize and reduced motion can cut the transition without changing the URL or showing a stale unit. Return focus follows the original card or outline.
- The plan retains the native lossless drawing; contextual exterior thumbnails prefer the existing AVIF derivative with a WebP alternative. Zoom keeps keyboard focus at the limits and announces the value. A cancelled pinch releases both pointers; arrival, floor selection and apartment details work without JavaScript.
- The two local inventories are read after the private guard rather than statically bundled. Production does not serve the preview or any private images, PDF files or overlay data.

## Coverage and source checks

| Scope | Verified |
|---|---|
| Exterior → floor | 5/5 floor-list entrances and returns; **0/5 façade targets approved**. No provisional floor shapes used. |
| Floor → apartment | **94 mapped, 0 unmapped**. L00: 16; L01, L02, L03: 19 each; L04: 21 duplexes. The gallery adds 21 registered outlines for those same units: **115 total**. |
| Direct apartment URLs | 94 main addresses and 21 gallery aliases, each tested from a cold page on 1440×900 and 390×844 Chromium. |
| Facts and media | 94 cross-checked listing, drawing and PDF joins; 757 distinct room rows; 28 discrepancies retained as separate source values (15 NP, 13 NKP). The availability date remains **23 November 2026**; it is not live. The 16 ground-floor sheet locator checks passed. |

The integration combines four independently checked changesets. The isolated motion suite passed 14 checks (focus/history, forward and reverse, cancellation, resize, reduced motion); visual checks passed at 10 sizes from 320×568 to 1920×1080. The visual lane reproduced an obsolete Stage 4 expectation even with styles blocked; the current test has a separate **Back to floor** step followed by **Back to exterior** and verifies the actual URLs. The media lane also ran Chromium keyboard and touch probes, verified native image bytes, and toggled AVIF support. The QA lane added the cold-route, source and production audits. The integrated test results below take precedence over the isolated ones.

## Integrated browser evidence

| Command | Result |
|---|---|
| `npx --no-install playwright test -c tests/web/stage6-selector.config.ts --workers=2` | **258 passed**, including every cold apartment route with WebGL disabled and five real exterior list journeys in each viewport. |
| `npx --no-install playwright test -c tests/web/exterior-explorer.config.ts --workers=2` | **27 passed, 5 intentionally skipped** by viewport. The suite includes touch, fallback formats, interrupted exterior camera motion, failures of both formats and the no-JavaScript exterior → floor → apartment path. |
| `npx --no-install playwright test -c tests/web/floor-plan-proof.config.ts --workers=2` | **22 passed**, including registration witness hit/miss tests, keyboard and gallery history, focus, missing drawings and privacy checks. |
| `npx --no-install playwright test -c tests/web/apartment-detail.config.ts --workers=1` | **38 passed**. Rechecked every registered outline under reduced motion at both sizes, native image hashes, all room rows, PDF links, and the exact return variant. Also checked normal-motion forward/reverse, cancellation, focus and zoom controls. [Log](stage2/private/stage6-integration/apartment-serial.log) |
| `PW_REDUCED_MOTION=1 npx --no-install playwright test -c tests/web/stage6-selector.config.ts --workers=1 --grep 'exterior list L02\|exterior list L04\|reduced motion selection\|cold .* H 0\.14 resolves\|cold .* H 4\.5 resolves'` | **12 passed**, covering exterior entry and return, the ground-floor garden case, both H 4.5 URLs and motion bypass. [Log](stage2/private/stage6-integration/stage6-reduced-journey.log) |
| `node scripts/validate/audit-mocire-accessibility.mjs` | **0 definite automated axe violations** in 8 view/viewport combinations. Axe requested manual contrast review for the image-backed exterior story and image loading message; the fixed backgrounds give at least **11.09:1** under the story’s lightest possible backdrop and **15.27:1** for the loading message. [Checks](stage2/private/stage6-integration/axe-final.jsonl) |
| `.venv/bin/python scripts/validate/check_mocire_stage2.py` and `.venv/bin/python scripts/validate/check_ground_sheet_locators.py` | Exit 0: **94** source joins, **115** valid outlines, **108** hash-checked WebPs, **0** public Stage 2 assets, and **16/16** ground-floor PDF locator cross-checks. |
| `.venv/bin/python scripts/validate/check_stage3_exterior.py` | Exit 0: both verified exterior originals and their 12 derivatives matched. The seven rings in the separate diagnostic fixture remain provisional and were not served by the app. |

The operator also used the live desktop app to select L04, open the gallery and H 4.5, verify the original plan and **91,05 m²**, zoom, reset and return to the same gallery. On the integrated app at **320×568, 1024×480 and 1920×1080**, the plan-entry link remained in view at 44 px high, and the resolved gallery apartment caused no horizontal overflow.

Running the suites together caused request and browser timeouts under host memory pressure. The 38 apartment checks passed on a one-worker rerun. The separate full 258-case **cold-URL** rerun with reduced motion did not finish within the command budget, so it is not counted as a pass; the targeted reduced-motion suite and the exhaustive reduced-motion footprint suite did finish.

## Private screenshots

| View | Desktop | Touch portrait |
|---|---|---|
| Exterior / L02 list selection | [PNG](stage2/private/stage6-integration/screens/desktop-exterior.png) | [PNG](stage2/private/stage6-integration/screens/portrait-exterior.png) |
| Floor / L02 | [PNG](stage2/private/stage6-integration/screens/desktop-floor.png) | [PNG](stage2/private/stage6-integration/screens/portrait-floor.png) |
| Apartment / H 4.5 gallery duplex | [PNG](stage2/private/stage6-integration/screens/desktop-apartment.png) | [PNG](stage2/private/stage6-integration/screens/portrait-apartment.png) |
| Selection zoom / H 2.1 | [PNG](stage2/private/stage6-integration/stage5-apartment-detail/desktop-L02-selection-zoom.png) | [PNG](stage2/private/stage6-integration/stage5-apartment-detail/portrait-L02-selection-zoom.png) |
| Return zoom / H 4.5 gallery | [PNG](stage2/private/stage6-integration/stage5-apartment-detail/desktop-L04-gallery-return.png) | [PNG](stage2/private/stage6-integration/stage5-apartment-detail/portrait-L04-gallery-return.png) |

We reviewed the exterior, floor and apartment captures at both sizes and representative motion frames. The full gallery duplex drawing remains visible at fit; the source stays pixel-registered; the exterior does not imply a location for the selected floor. All art captures and traces are Git-ignored.

## Performance observations

The contextual façade image fell from **57,024 bytes (WebP) to 41,835 bytes (AVIF), 26.6% less**. The existing WebP derivative was verified as a browser-format fallback. The full floor and apartment images remain lossless at their registered dimensions so detail zoom does not exchange legibility or alignment for smaller files.

In the integrated normal-motion loopback samples, arrival loaded two verified AVIF stills (**205.3 KiB** together); L02 loaded one **210.7 KiB** WebP; the H 4.5 gallery loaded **604.3 KiB** of imagery, including the **369.1 KiB** individual duplex plan. Those particular load events ranged from **206–287 ms**. A later run under more host load observed the required image decoded by **1.0–2.3 s**, so local load timing is not a release benchmark. The sampled H 2.1 selection reached its detail in **674–690 ms**, with a **16.7–16.8 ms** p95 animation-frame gap. Reduced motion skipped the zoom and reached the detail in **46–50 ms**. [Profile](stage2/private/stage6-integration/profile-stage6.json)

These are encoded media sizes and local development-browser observations, not production Web Vitals or a guarantee for a mobile network. No GLB, WebGL renderer or video was needed.

## Build and production containment

- `npm run lint && npm run test && npm run build && npm run typecheck && git diff --check`: exit 0; **31 unit tests** passed and Next.js 16.4.6 built successfully.
- Against a separate `next start` on port 3214 with `MOCIRE_EXTERIOR_PREVIEW=1`, `node tests/web/stage6-production-audit.mjs …/production-audit.json` found **HTTP 200** for `/` and **HTTP 404** for all **252** preview/source-path probes. **12** trace manifests had no private file dependencies. Known private matches: **0** in public/client assets, pre-rendered payloads and compiled server chunks. The scanner matches actual private values, URLs and paths, not TypeScript property names retained in source maps. [Audit JSON](stage2/private/stage6-integration/production-audit.json)
- The root Playwright runner now discovers its two `/viewer` sandbox checks. It is not the selector suite, and the synthetic sandbox was not part of this verification.

## Release blockers and limits

Owner approval is still needed for a floor-to-façade key on the exact source still, including the occluded ground-floor treatment, and for public use of both the art and registrations. The verified exterior-to-floor handoff remains blocked; the private list path is deliberate. Production build success is not permission to publish. Test devices are Chromium emulations; this is not a cross-engine or manual screen-reader certification.

The missing-image checks confirm that the verified details and navigation remain available. With all images deliberately blocked, the decorative façade thumbnail can still show the browser’s missing-image icon.
