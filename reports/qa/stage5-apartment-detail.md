# Stage 5 · Močire H apartment detail

**24 November 2026 — PASS for the private apartment-detail experience.** The exterior remains list-based: there is no approved floor key for the exterior image and no public-use grant for the source art. This is not release or full Gate 3–5 sign-off.

Start `npm run dev:exterior`, open [the private exterior](http://127.0.0.1:3103/exterior-preview), choose a floor, then **Provjeri tlocrt**. Select an outline or a card. The registered outline is highlighted and framed before a 300 ms reveal of the individual drawing. With reduced motion the switch is immediate. Try [H 4.5 from the gallery](http://127.0.0.1:3103/exterior-preview/plans?floor=L04&plan=gallery&unit=H+4.5); **Natrag na etažu** returns to that same gallery drawing, and the breadcrumb returns to the exterior.

## Mapping and source QA

| Floor | Mapped apartments | Unmapped | Registered outlines | Individual plans |
|---|---:|---:|---:|---:|
| L00 · Ground | 16 | 0 | 16 | 16 |
| L01 | 19 | 0 | 19 | 19 |
| L02 | 19 | 0 | 19 | 19 |
| L03 | 19 | 0 | 19 | 19 |
| L04 · Main | 21 | 0 | 21 | 21 |
| L04 · Gallery | Same 21 | 0 | 21 | Same 21 |
| **Distinct total** | **94** | **0** | **115** | **94** |

The browser suite clicked or tapped an independent source witness for every outline on both viewports (**230 selections**). It checked the selected ID and floor, highlighted polygon, WebP SHA-256 and native dimensions, exact listing area, source status and date, PDF URL, all **757** schedule rows and PDF totals, and return to the same floor and variant. It asserted both source values for all **28** documented discrepancies (15 NP and 13 NKP); no measurement was derived from the overlay. The listing date shown is **23 November 2026**: 43 units were listed `Slobodno` and 51 `Prodano`. No live availability is inferred.

Motion and focus were checked through the exterior-to-floor list journey, including Back/Forward and reload. The viewer was tested for whole-plan fit, button zoom and reset, arrow-key pan, desktop drag and touch pinch. Missing unit art leaves the verified facts and floor locator; an invalid unit address keeps the URL and offers the floor list. Cards, measurements and document links remain available without JavaScript. The sample journeys made no GLB or public drawing/overlay requests. Original PDF viewing and downloading use Sigma's own links; no PDF is rehosted. The inquiry opens Sigma's form with a prompt in the preview to include the exact unit ID.

## Private screenshots

| Case | Desktop · 1440×900 | Mobile · 390×844 |
|---|---|---|
| H 0.14 · Ground, garden and terrace | [Plan](stage2/private/stage5-apartment-detail/desktop-H-0.14.png) · [Schedule](stage2/private/stage5-apartment-detail/desktop-H-0.14-schedule.png) | [Plan](stage2/private/stage5-apartment-detail/portrait-H-0.14.png) · [Schedule](stage2/private/stage5-apartment-detail/portrait-H-0.14-schedule.png) |
| H 1.16 · Floor 1, source discrepancy | [Plan](stage2/private/stage5-apartment-detail/desktop-H-1.16.png) | [Plan](stage2/private/stage5-apartment-detail/portrait-H-1.16.png) |
| H 2.1 · Floor 2, selection journey | [Floor](stage2/private/stage5-apartment-detail/desktop-L02-floor.png) · [Zoom](stage2/private/stage5-apartment-detail/desktop-L02-selection-zoom.png) · [Plan](stage2/private/stage5-apartment-detail/desktop-L02-H-2.1.png) | [Floor](stage2/private/stage5-apartment-detail/portrait-L02-floor.png) · [Zoom](stage2/private/stage5-apartment-detail/portrait-L02-selection-zoom.png) · [Plan](stage2/private/stage5-apartment-detail/portrait-L02-H-2.1.png) |
| H 3.18 · Floor 3, compact layout | [Plan](stage2/private/stage5-apartment-detail/desktop-H-3.18.png) | [Plan](stage2/private/stage5-apartment-detail/portrait-H-3.18.png) |
| H 4.20 · Floor 4, duplex with terrace | [Plan](stage2/private/stage5-apartment-detail/desktop-H-4.20.png) | [Plan](stage2/private/stage5-apartment-detail/portrait-H-4.20.png) |
| H 4.5 · Edge duplex, gallery return | [Plan](stage2/private/stage5-apartment-detail/desktop-H-4.5.png) · [Zoomed](stage2/private/stage5-apartment-detail/desktop-H-4.5-zoomed.png) · [Schedule](stage2/private/stage5-apartment-detail/desktop-H-4.5-schedule.png) | [Plan](stage2/private/stage5-apartment-detail/portrait-H-4.5.png) · [Zoomed](stage2/private/stage5-apartment-detail/portrait-H-4.5-zoomed.png) · [Schedule](stage2/private/stage5-apartment-detail/portrait-H-4.5-schedule.png) |

All 22 captures contain private art and are Git-ignored. Visual review caught a clipped tall drawing at reset; the viewport now fits the whole source sheet, with a ratio/containment regression check. The final browser runs also pass the pre-existing narrow-screen floor-switching check without JavaScript.

## Reproduction

| Check | Observed result |
|---|---|
| `npx --no-install playwright test -c tests/web/apartment-detail.config.ts` | Exit 0; **30 passed** in Chromium at desktop and touch portrait sizes. |
| `npx --no-install playwright test -c tests/web/floor-plan-proof.config.ts --output reports/qa/stage2/private/stage5-stage4-regression --grep 'rejects invalid\|does not serve\|also work without'` | Exit 0; **6 passed**. |
| `.venv/bin/python scripts/validate/check_mocire_stage2.py` | Exit 0; **94** listing/detail/PDF joins, **115** valid polygons, **0** public Stage 2 asset files. |
| `.venv/bin/python scripts/validate/check_ground_sheet_locators.py` | Exit 0; all **16** PDF location hatches identify the expected ground-floor apartment. |
| `npm run lint && npm run test && npm run build && npm run typecheck && git diff --check` | Exit 0; **31** unit tests, production build succeeded, no lint, TypeScript or whitespace diagnostics. |
| `MOCIRE_EXTERIOR_PREVIEW=1 next start --hostname 127.0.0.1 --port 3204` and HTTP/trace audit | `/` returned 200, private pages and all checked media routes returned 404; **0** private sources in **10** production app traces. |
| `curl --head --location` on the H 0.1 publisher PDF and Sigma inquiry | Both 200; PDF and HTML content types respectively. The browser suite checked all 94 PDF destinations against the saved source ledger without resubmitting any inquiry. |

No interior model, furniture, walkthrough, video or 3D apartment renderer was added. Stage 5 ends here.
