# Močire Zadar H — scope reset, 23 November 2026

## Stage 6 checkpoint · 24 November 2026

**Follow-up:** the [final polish QA report](qa/stage6-final-polish.md) records the updated typography and layouts, the mobile native-size framing fix, removal of the decorative thumbnail, eight inspected screenshots, **258** integrated Playwright passes, **12** targeted reduced-motion passes, and **33** unit tests. The private preview remains live at `http://127.0.0.1:3103/exterior-preview`. A fresh production build returned **404** for all **252** private-route/media probes. This is a private QA pass, not a release-gate sign-off.

**Private preview polished and tested; public release remains blocked.** The [Stage 6 QA report](qa/stage6-private-quality.md) records 258 integrated normal-motion checks, 87 regression checks, a 12-case reduced-motion smoke run, the full reduced-motion cold-suite timeout, screenshots, performance samples and production isolation. The private journey runs at `http://127.0.0.1:3103/exterior-preview` with **five floor groups, six drawings, 94 mapped apartments and zero unmapped**. The owner-approved exterior floor key and public-use rights are still missing; no provisional façade targets or release assets were added.

## Stage 5 checkpoint · 24 November 2026

**Private apartment detail passes.** The registered plan outline highlights and zooms into the exact source drawing. The detail shows the listing area, original room schedule and dated status, with interactive plan controls, publisher PDF and inquiry links, and URL-backed return to the same floor or gallery. [QA and screenshots](qa/stage5-apartment-detail.md): **94 mapped, 0 unmapped; 115 registered outlines**, 30 Stage 5 and six Stage 4 regression browser checks passed on desktop and portrait mobile. The exterior remains list-only and release clearance is unchanged.

## Stage 4 checkpoint · 24 November 2026

**Private floor-plan review passes; full Stage 4 remains blocked.** From the loopback exterior preview, select a floor by list and choose **Provjeri tlocrt**. All five floor groups and the L04 gallery load their Stage 2 plans and overlays; apartment selection stops at the exact ID. [QA evidence](qa/stage4-plan-proof.md) covers 22 passing Playwright checks on desktop and portrait mobile, screenshots, and failures found during implementation.

The review link does not invoke or clear the guarded exterior handoff. No exterior-region highlight, level-targeted zoom, forward/reverse image transition, release promotion, or apartment detail screen was implemented. Full-scope Gates 2–4 remain open, pending an approved exterior floor key.

## Stage 3 update · 24 November 2026

The private Next.js exterior preview is running at `http://127.0.0.1:3103/exterior-preview` (`npm run dev:exterior`). Real Sigma `_001` and `_000` images, GSAP 2D framing, touch/keyboard controls and URL-backed list selection are implemented. [Private QA](qa/stage3-exterior-next.md) records 26 browser checks passed across four viewports, lint/typecheck, 28 unit tests, the production build and the production 404 checks. The Stage 2 data validator still passes.

**Stage 3 floor-focus acceptance remains blocked.** All five floors are available by list, but none has a verified exterior target. The earlier diagnostic map remains provisional and is not integrated. No change to the Gate 2 or Gate 3 decision, public homepage, or release assets. See the [exterior contract](../docs/STAGE-3-EXTERIOR.md) for the Stage 4 dependency and the guarded handoff.

## Stage 2 update · 23 November 2026

**Private asset collection and floor mapping complete.** The [source ledger](../docs/ASSET-SOURCES.md) covers 202 originals and 108 optimized images. The [verification report](qa/stage2/verification.md) links desktop/mobile evidence for all six drawings and a second PDF-key check for all 16 ground-floor apartments. The data deliverables are `src/data/floors.json` and `src/data/apartments.json`: five floors, 94 units, 757 schedule entries, and source-area differences flagged on 28 units (13 NKP, 15 NP). 115/115 image-specific polygons pass identity and geometry checks. No raw art, derived plan or SVG was promoted to `public/`.

**Gate decisions:** [G2 source & rights](gate2-source-rights.md) and [G3 registration](gate3-overlay-geometry.md) are open for the complete selector: the eight H renders are now local, but an approved exterior floor key and release rights are not established. No website integration was started. The scope-reset inventory below predates Stage 2.

**Decision:** build on the existing Next.js app. The visitor chooses a floor on an exterior still, chooses a unit on that floor's 2D plan, then reads the apartment details. The [build plan](../docs/BUILD-PLAN.md) defines the three URL states, SVG registration and GSAP transitions. The [gates](../docs/workflow-gates.md) define what evidence is needed before implementation and release.

**Status:** planning and inventory complete. **G1 Web baseline passes** on this machine; **G2 Source & rights is open**. The homepage is a starter page and `/viewer` is a synthetic demo. None of G2–G6 is claimed by the old setup reports. No application, drawing, model or media was produced or changed in this reset.

## What is available

| Existing item | Use in the selector |
|---|---|
| `src/app/`, `src/components/ui/`, `src/app/globals.css`, `src/lib/viewer/reduced-motion.ts` | Reuse the App Router, UI primitives, focus styles and motion preference. Next 16.4.6, React 19.3.0 and GSAP 3.15.1 are installed. |
| `assets/source/mocire-zadar-h/inventory.json` and local `raw/` | Five main floor PNGs (L00–L04), one gallery plan and one mixed PDF for H 0.1. All seven raw files match the hashes and sidecars. The raw directory is ignored by Git and local-prototype-only. See [source inventory](../docs/source-inventory.md) for the files and dimensions. |
| `assets/geometry/apartments.json` and `schema/apartments.schema.json` | 94 unique listings: 16 / 19 / 19 / 19 / 21 per floor. Use exact `unit_id`, floor, Croatian type label, listing area, status and `source_ref`. Status is a dated snapshot (43 Slobodno, 51 Prodano). `gross_area_m2` stores **Obračunska površina**, not a verified gross or net measurement. All 94 lack verified net area and orientation; no prices are sourced. |
| `scripts/pdf/`, `scripts/validate/`, `tests/geometry/` | Reuse provenance, inventory-building and validation tooling. No real metric geometry was established. Metric reconstruction is unnecessary for pixel-registered overlays. |
| `tests/unit/`, `tests/web/`, `tests/visual/`, `reports/screenshots/` | Reuse test infrastructure and desktop/mobile conventions. Existing screenshots and tests cover the sandbox; there is no selector journey test yet. |
| `public/models/test/`, `scripts/blender/out/`, `assets/blender/`, `/viewer` | Placeholder/smoke GLBs, manifest, test `.blend`/IFC, PBR textures, smoke still and standalone Three.js viewer. Retain as tools/fixtures. None depicts this project; no verified H exterior model or approved overview still was found. |
| `assets/geometry/synthetic-room-6x4/`, `docs/shots/`, `video/`, `scripts/video/`, `public/media/` | Preserve the synthetic fixture, shot briefs, compositions, placeholders and smoke outputs as prior work. They are not inputs or deliverables for the selector. |

## What the references add

- [Sigma](https://www.sigma.hr/projekti/mocire-zadar-h/) links five floor pages and a building-H exterior gallery (`Mocire_H-Zadar_000–007`). The gallery is a lead for obtaining an owner-supplied still; its presence online does not grant publication rights.
- The five floor pages already pair the PNGs with HTML image maps. A read-only parse (`curl -fsSL` on each inventory `page_url`, `HTMLParser` join from `img[usemap]` to `map`/`area[href]`, comparison with local PNG dimensions) found **94/94 matching primary unit URLs**. The gallery map links the **same 21 L04 units**; it does not add a selectable floor. The main L04 map for **H 4.5** reaches y=587 on a 586-pixel-high image. Review against owner-approved art or keep that entry list-only; do not silently clip it. Coordinates have not been imported, cleared or visually verified.
- The [Kozielska deep link](https://kozielska.vinode.io/Kozielska/Zone_A/Kozielska_A1V/2_06?floor=2) opens an apartment with floor context and a details panel. Adopt addressable selection and return navigation. All building facts, unit IDs and imagery for this site must come from the Močire project.

## Handoff and blockers

| Gate / deliverable | Dependency or blocker | Acceptance before advancing |
|---|---|---|
| 2 · Local input and rights register | Owner/source contact: obtain a clearly identified H exterior still with legible floors and corresponding floor key; identify approved plan art, map sources and permitted use for each. No release clearance is recorded. | Match asset versions, dimensions and provenance to intended use; distinguish local inspection from release. Raw Sigma files never move into `public/`. |
| 3 · Reviewed SVG registrations | Depends on chosen exterior and plan versions. There is no reviewed exterior floor-band or local unit-polygon dataset. | Check each image/level/unit join, shape bounds and alignment at desktop and mobile sizes. Resolve H 4.5 or document a reviewed text-link exception. |
| 4 · OVERVIEW → FLOOR → APARTMENT | Depends on G3. No production state controller, SVG selector or details route behavior exists. | Direct URLs, up/Back/Forward, keyboard, touch, focus and reduced motion reach the same unit; lists remain usable without images or WebGL. |
| 5 · Release art and unit facts | Obtain first-party/authorized release assets, review publication of derivatives, confirm the listing date and sales wording; other unit sheets are not local. | Rights manifest covers every published image/map; use only sourced fields. Missing price, net area or sheet does not block a listing-only detail panel. |
| 6 · Selector QA | Repair root Playwright configuration and add selector-specific tests. The current visual spec exercises mesh/camera behavior. | Root E2E suite runs on desktop and mobile; assert exact floor/unit selected and no GLB/Three.js dependency on the default path. |

**First input needed:** a usable owner-supplied exterior view and floor identification key, plus the allowed local and release uses of the art and maps. No model, furniture package or film is needed to unblock this.

## Orchestration and tooling

- Seven project role definitions are retained. Orchestrator handles gates; geometry-extractor owns inventory/registrations; web-3d-builder owns the image-first web flow; visual-qa-reviewer reviews it; doc-scribe maintains docs. Blender is conditional on an exterior need. Workspace-scoped `GET /api/agent` exposed these six roles; `cinematic-director` was absent. Its definition is disabled and the orchestrator no longer delegates to it. Historical setup evidence: `reports/setup-{A,B,C,D,E}-*`.
- The workspace-scoped desktop `GET /api/mcp` reported `context7`, `shadcn` and `blender` **connected**. Read-only Blender calls `get_addon_status` and `get_scene_info` returned `5.3.0` and an unsaved scene containing `Cube`, `Light`, `Camera`. These are authoring tools, not runtime dependencies. Inherited `ctx` and `comfyui` reported `failed`; neither is needed. The existing local Blender MCP settings were preserved.
- Project automation list: **empty**. The workspace session search found no unfinished matching interior, furniture, furnishing, walkthrough or cinematic task; the prior HyperFrames session had succeeded. No render was started and no user desktop application was terminated.

## Checks run on the existing checkout

| Command or inspection | Result |
|---|---|
| `npm ls next gsap three react @playwright/test --depth=0` | Next 16.4.6, GSAP 3.15.1, Three 0.187.0, React 19.3.0, Playwright 1.65.1. |
| `npm run lint` / `npm run typecheck` | Both exited 0 with no diagnostics. |
| `npm run test` | `Test Files 4 passed (4)`; `Tests 18 passed (18)`. |
| `npm run build` | `Compiled successfully`; static `/`, partial prerender `/viewer`. Existing scaffold only. |
| `.venv/bin/python -m pytest tests/geometry -q` | `22 passed, 5 warnings` (binding deprecations). |
| `.venv/bin/python scripts/validate/validate_geometry.py assets/geometry/synthetic-room-6x4/geometry.json --apartments assets/geometry/apartments.json` | `PASS assets/geometry/synthetic-room-6x4/geometry.json`. This validates the fixture, not Močire geometry. |
| Python `jsonschema.Draft202012Validator`, join on `(unit_id, level, source_ref)`, `hashlib.sha256` on local files | Schema passed; 94/94 records agree with the snapshot on identity, level, type, status and listing area; 7/7 downloads and sidecars agree; no exact raw source hashes among 12 public files. Hash comparison is not a rights audit. |
| `scripts/doctor.sh --ci` | `23 PASS, 3 WARN, 0 FAIL` (machine-specific Blender, HyperFrames and browser checks skipped). |
| `npx --no-install playwright test --list` | **Exit 1**, before running tests: `Either 'port' or 'url' should be specified in config.webServer.` Root config specifies both. |
| `npx --no-install playwright test -c tests/web/viewer-smoke.config.ts --list` | `Total: 4 tests in 1 file` (discovery only; synthetic viewer). |
| `git diff --check`; gate/role comparison and `git status --porcelain` scoped to implementation and asset paths | No whitespace errors; six ordered gate names agree with `AGENTS.md`; cinematic role disabled with no delegation grant; implementation and asset paths clean. |

## Files changed in this reset

- Created `docs/BUILD-PLAN.md` and `reports/progress.md`.
- Updated project rules and routing descriptions: `AGENTS.md`, `opencode.jsonc`. The pre-existing Blender MCP enablement/port edit is preserved.
- Updated the seven `.opencode/agents/` definitions: `orchestrator-architect.md`, `geometry-extractor.md`, `web-3d-builder.md`, `visual-qa-reviewer.md`, `doc-scribe.md`, `blender-builder.md` and `cinematic-director.md`.
- Updated workflow docs: `docs/workflow-gates.md`, `docs/runbook.md`, `docs/agent-orchestration.md`, `docs/model-routing.md`.
- Updated architecture and inventory docs: `docs/web-viewer.md`, `docs/design-system.md`, `docs/source-inventory.md`, `docs/architectural-data-pipeline.md`, `docs/blender-pipeline.md`.
- Marked the video guides historical: `docs/hyperframes-workflow.md`, `docs/video-model-selection.md`.
