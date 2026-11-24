# Stage 3 exterior explorer · private QA · 24 November 2026

**Decision:** working private Next.js preview; Stage 3 floor-focus acceptance is **blocked**. Whole-selector Gates 2 and 3 remain open. The preview uses real Močire H imagery, but there is no verified link between a band on an exterior render and a named floor. No plan screen, new building model, video, or release work was undertaken.

## Run and evidence

`npm run dev:exterior` → `http://127.0.0.1:3103/exterior-preview`. To verify the local assets, run `.venv/bin/python scripts/validate/check_stage3_exterior.py`. The earlier diagnostic proof and its provisional map are separate.

| Frame reviewed | Arrival | Façade | List selection |
|---|---|---|---|
| Desktop 1440 × 900 | [Arrival](stage2/private/stage3-next/desktop-arrival.png) | [Façade](stage2/private/stage3-next/desktop-facade.png) · [list hover](stage2/private/stage3-next/desktop-list-hover.png) | [Etaža 2](stage2/private/stage3-next/desktop-selected.png) |
| Laptop 1280 × 800 | [Arrival](stage2/private/stage3-next/laptop-arrival.png) | [Façade](stage2/private/stage3-next/laptop-facade.png) | [Etaža 2](stage2/private/stage3-next/laptop-selected.png) |
| Mobile portrait 390 × 844 | [Arrival](stage2/private/stage3-next/portrait-arrival.png) | [Façade](stage2/private/stage3-next/portrait-facade.png) | [Etaža 2](stage2/private/stage3-next/portrait-selected.png) |
| Mobile landscape 844 × 390 | [Arrival](stage2/private/stage3-next/landscape-arrival.png) | [Façade](stage2/private/stage3-next/landscape-facade.png) | [Etaža 2](stage2/private/stage3-next/landscape-selected.png) |

Review iterations corrected unscoped CSS modules, a portrait crop that missed the oblique corner, an obstructive floor panel, and a low-contrast intermediate pressed state. The final portrait crop intentionally shows part of the long façade; it does not distort it. The list hover screenshot shows only UI feedback, **not** an architectural highlight. Screenshots are local and Git-ignored.

## Inputs and coverage

| Asset | Role | Key |
|---|---|---|
| [Sigma `_001`](../../docs/ASSET-SOURCES.md) | Arrival, oblique | `632da4f4…d13c`, 1920 × 1080, no baked crop |
| [Sigma `_000`](../../docs/ASSET-SOURCES.md) | Building focus, frontal | `6854a82a…ec2a`, 1920 × 1080, no baked crop |
| `src/data/floors.json` | Floor identity and plan references | L00–L04; L04 gallery is a second plan variant |

All five floors are selectable in the list. L00 is obscured on `_000`; L01–L03 are unconfirmed dark-band candidates and the proposed L04 upper band is unconfirmed. The [audit](../../assets/geometry/stage3/exterior-audit.md) found no annotated exterior or elevation to establish identity. **0/5 approved exterior registrations; 5/5 list selections; 0/5 floor-specific endpoints.** The older proof's four provisional floor IDs are not loaded in the Next.js preview.

## Verification

| Command | Result |
|---|---|
| `npm run test:e2e:exterior` | **26 passed, 0 failed**; six skipped duplicates (server-poster and HTTP checks run once on desktop). Chromium across the four sizes above. |
| `npm run lint` · `npm run typecheck` · `npm run test` | Clean lint/typecheck; **28 unit tests passed**. |
| `npm run build` | Compiled successfully; `/` still static, `/viewer` still partially prerendered. `next start` with the preview opt-in set returned **200** for `/`, **404** for `/exterior-preview`, and **404** for its media. |
| Stage 2 validator | 202 original assets, 108 WebPs, 94 unit joins, and 115 plan polygons passed. Zero Stage 2 assets in `public/`. |
| Stage 3 asset/provisional proof validator | Both source hashes and all 12 derivatives passed. All seven older provisional rings pass pixel bounds/overlap/containment, **not** floor identity. |
| `playwright test -c tests/web/stage3-preview.config.ts --grep 'interruption\|preserves floor'` | **8 passed** on the unchanged earlier proof. It remains unapproved. |
| `/viewer` smoke | Headless Chromium reached `window.__viewer.ready` and found one canvas. |
| `npm run test:e2e -- --list` | Existing root runner still stops before discovery because `webServer` specifies both `port` and `url`. The dedicated exterior runner does not use this configuration. |

The integrated test suite verifies real image loads, a server-rendered poster with JS disabled, AVIF-to-WebP fallback, text selection when both formats fail, accepted and rejected addresses, keyboard and touch selection, Back/Forward and refresh, interruption, reset, two-view reversal, resize, and reduced motion. Image/SVG-plane drift is asserted below **0.8 CSS px** during animation, pan and resize. This tests registration mechanics only; no floor-polygon alignment or image-to-list equivalence is claimed. Native pinch is allowed by CSS and horizontal touch pan was exercised in Chromium; native Safari and pinch gestures on physical hardware were not tested.

## Motion and loading

Arrival and building focus use bounded GSAP 2D framing and a 1.14 s dissolve between real stills; there is no new perspective or parallax. Manual zoom is faster, and reduced motion snaps. In local Chromium all four final profiles chose the 1920 AVIFs: `_001` **116,794 bytes** and `_000` **93,430 bytes**, **210,224 bytes** combined before headers. The largest fallback is arrival WebP (**167,274 bytes**). The arrival is prioritized, with the other view loaded at lower priority for the dissolve. The ladder also has 960 and 1280 widths. No Three.js model, plan art, or private SVG is requested by the explorer. These byte counts are not production LCP measurements.

## Handoff

See [the asset and interaction contract](../../docs/STAGE-3-EXTERIOR.md). The current `getFloorHandoff` returns the stable floor and plan references with `NO_VERIFIED_EXTERIOR_REGISTRATION` and `endpoint: null`. A ready handoff must pair the reviewed polygon/focus/zoom on the exact render hash with the final viewport of that floor. `openSelectedFloorPlan(handoff, open)` will not call its Stage 4 action while blocked. Remaining inputs: approved exterior registration, an explicit decision on the obscured ground-floor exception, and art/registration rights before release.
