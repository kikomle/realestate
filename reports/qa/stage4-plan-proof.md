# Stage 4 checkpoint · Močire H

**24 November 2026 — PASS for private plan review; BLOCKED for the requested façade → targeted zoom → plan sequence.** This is not Gate 3 or Gate 4 sign-off and confers no release permission.

## What was verified

Run `npm run dev:exterior` and open `http://127.0.0.1:3103/exterior-preview`. Select a floor from the text list and choose **Provjeri tlocrt**, or go directly to `/exterior-preview/plans?floor=L02` (substitute any known floor). For the L04 gallery, append `&plan=gallery`. Check a particular unit with `&unit=H+2.1` on L02. The screen displays only the selected source ID, not apartment details.

Each plan is a hash-checked, lossless WebP of the source drawing. The SVG coordinates are read from the corresponding hash-checked Stage 2 registration without rescaling, clipping or redrawing. The SVG and image share the native drawing frame. No raw SVG or original drawing is served. The full-plan view, readable horizontal pan and optional native-pixel view reuse the same art and overlay.

| Floor / drawing | Registered footprints | Independent hits / misses checked per viewport | Desktop | Mobile |
|---|---:|---:|---|---|
| L00 · ground | 16 | 38 | [Selected](stage2/private/stage4-plan-proof/desktop-L00-selected.png) | [Selected](stage2/private/stage4-plan-proof/portrait-L00-selected.png) |
| L01 | 19 | 45 | [Selected](stage2/private/stage4-plan-proof/desktop-L01-selected.png) | [Selected](stage2/private/stage4-plan-proof/portrait-L01-selected.png) |
| L02 | 19 | 45 | [Selected](stage2/private/stage4-plan-proof/desktop-L02-selected.png) | [Selected](stage2/private/stage4-plan-proof/portrait-L02-selected.png) |
| L03 | 19 | 45 | [Selected](stage2/private/stage4-plan-proof/desktop-L03-selected.png) | [Selected](stage2/private/stage4-plan-proof/portrait-L03-selected.png) |
| L04 · main | 21 | 49 | [Selected](stage2/private/stage4-plan-proof/desktop-L04-selected.png) | [Selected](stage2/private/stage4-plan-proof/portrait-L04-selected.png) |
| L04 · gallery | 21 | 44 | [Selected](stage2/private/stage4-plan-proof/desktop-L04-gallery-selected.png) | [Selected](stage2/private/stage4-plan-proof/portrait-L04-gallery-selected.png) |
| **Total: 5 groups, 6 drawings** | **115 (94 distinct IDs)** | **266 at each size** | **1440×900** | **390×844, touch** |

Tests used independent points from the source plans and real browser hit testing, including shared circulation that must not select a unit. They confirmed image/SVG alignment within 0.8 CSS px, desktop single-unit hover, pointer/touch selection of a representative footprint on each drawing, keyboard selection, floor switching, in-page breadcrumb and back links, browser Back/Forward, reload, and preserved `H 4.5` selection between L04 main and gallery. The text list remained usable with the image blocked or JavaScript disabled. Invalid floor and plan URLs and cross-site requests were rejected. The checked plan journeys loaded no GLBs or public plan/overlay files and had no console or page errors.

Additional captures: blocked façade on [desktop](stage2/private/stage4-plan-proof/desktop-exterior-blocked.png) and [mobile](stage2/private/stage4-plan-proof/portrait-exterior-blocked.png); mobile [reading view](stage2/private/stage4-plan-proof/portrait-L02-reading.png) and [native-pixel view after pan](stage2/private/stage4-plan-proof/portrait-L02-native.png). Captures and traces contain private art and are Git-ignored.

## Failures and disposition

| Finding | Status |
|---|---|
| **Blocker:** zero verified exterior bands for L00–L04. L00 is occluded in the front still and has no approved list-only exception. L01–L04 hand traces are provisional, even when their shapes pass pixel checks. | Open. No band, floor-specific camera pose, animated forward/reverse handoff, or physical flight was fabricated. The tested round trip is **exterior text list → private plan → unit ID → exterior**. It uses a separate page and a deliberate cut, not the requested zoom. |
| First integrated Playwright run: 14 passed, 6 failed. Next streamed HTTP 200 for rejected pages and hid the text UI without JavaScript. | Fixed by using non-streamed plan rendering in the dedicated local server; production cache configuration is unchanged. [Failure screenshots and traces](stage2/private/stage4-attempt-1/). |
| Production tracing initially included private paths through both the new reader and the existing exterior media route. After the first fix the old exterior route still traced 531 private paths. | Fixed by excluding local filesystem path construction from tracing. The final audit found no private assets in any of the nine production app traces. Local file checksums and HTTP allowlists remain enforced. |

## Reproduction

| Command | Observed result |
|---|---|
| `.venv/bin/python scripts/validate/check_mocire_stage2.py` | Exit 0: 5 floors, 94 joined units, 115 polygons, zero invalid/missing/duplicate/overlapping/wrong-floor shapes and zero public Stage 2 asset files. |
| `.venv/bin/python scripts/validate/check_stage3_exterior.py` | Exit 0: two native images and twelve derivatives verified. Seven provisional rings passed **pixel geometry only**; no architectural verification. |
| `npx --no-install playwright test -c tests/web/floor-plan-proof.config.ts` | Exit 0: **22 passed** (Chromium desktop and portrait). |
| `npm run test:e2e:exterior -- --grep-invert 'captures the private compositions'` | Exit 0: **22 passed, 6 pre-existing viewport skips**. The screenshot-writing case was excluded to preserve prior artifacts. |
| `npm run lint && npm run test && npm run build && npm run typecheck` | Exit 0: lint and typecheck clean, 28 unit tests passed, production build succeeded. |
| `npm run build` and audit of `.next/server/app/**/*.nft.json` | Exit 0: nine traces, zero private raw assets, overlays or QA captures. |
| `MOCIRE_EXTERIOR_PREVIEW=1 next start --hostname 127.0.0.1 --port 3204` and HTTP checks | `/` returned 200; the exterior and plan pages, both media routes, and the checked public plan/overlay paths returned 404 even with the private flag set. |

To complete the full Stage 4 sequence, obtain a reviewed exterior floor-to-image key for the exact still version, covering every visible floor and explicitly resolving any occlusion exception. Then verify the exterior highlight and reversible 2D transition. Apartment detail work has not started.
