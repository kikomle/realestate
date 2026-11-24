# Web viewer (Agent C)

**Planned visitor route:** the [build plan](BUILD-PLAN.md) specifies an image-first selector at `/`. The current homepage is a scaffold; `/viewer` is a separate synthetic GLB sandbox. It is not an H exterior or part of floor and unit selection.

## Planned image-first baseline

- OVERVIEW `/` links to a FLOOR such as `/?floor=L02`; its unit links open APARTMENT, e.g. `/?floor=L02&unit=H%202.1`. Validate the exact decoded `unit_id` and `level` against `assets/geometry/apartments.json`. Keep invalid URLs visible and link to the nearest valid ancestor.
- HTML floor and unit links provide the baseline, including without images or WebGL. Give SVG links the same destinations and accessible names. Support keyboard focus, cold entries, up links and browser Back/Forward. Skip cross-fades for reduced motion.
- Register OVERVIEW by `(image, level)` and FLOOR by `(image, level, unit_id)`. Use the exact image hash, intrinsic pixel dimensions, matching `viewBox` and shared crop. Never copy Sigma polygon coordinates.
- No H release art is cleared. Raw source drawings stay in `assets/source/` and **never** enter `public/`, even if a derivative is cleared. Release only first-party or explicitly cleared derivatives, with separate permission for each matching map. See the [source inventory](source-inventory.md).
- The default route must fetch neither Three.js nor a GLB. Any future exterior enhancement needs a documented use, verified and cleared input, lazy loading and equivalent image/list navigation.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port 3000 (or next free port) |
| `npm run build` | Production build (static `/`, partial prerender `/viewer`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config, ignores other agents' folders) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests in `tests/unit/` |
| `npm run test:e2e` | Root Playwright runner; see the [runbook](runbook.md) for its configuration blocker. The sandbox smoke spec is in `tests/web/`. |
| `node scripts/web/make-placeholder-glb.mjs` | Regenerates `public/models/test/placeholder-building.glb` (idempotent) |

## Sandbox structure (`/viewer`)

- `src/app/viewer/page.tsx`: route; reads `?model=` via `searchParams` inside `<Suspense>`.
- `src/components/viewer/SceneViewer.tsx`: loading, error, WebGL fallback, Canvas host.
- `src/components/viewer/ModelScene.tsx`: GLB via `useGLTF`, lights, shadows, ACES tone mapping, click picking, emissive highlight, `window.__viewer` test hook.
- `src/components/viewer/CameraRig.tsx`: GSAP fly-to (1.2 s, `power2.inOut`), instant snap for reduced motion.
- `src/components/viewer/Picker.tsx`, `ModelSelector.tsx`: overlay card and model source line.
- `src/lib/semantic-id.ts`: `{BUILDING}__{LEVEL}__{UNIT}__{TYPE}__{INDEX}` parser.
- `src/lib/viewer/`: `model-url.ts` (same-origin `/models/*.glb` allow-list), `camera.ts`, `reduced-motion.ts`, `metadata.ts`.

## Loading a sandbox model

- Default: `/models/test/placeholder-building.glb`.
- Override: `/viewer?model=/models/test/<file>.glb`. Only same-origin paths under `/models/` ending in `.glb` are accepted; anything else falls back to the default.
- Agent A's GLBs go in `public/models/test/` (or `public/models/<set>/`). Node names must follow the naming convention; the viewer reads `node.name` as `semantic_id`, and parses it with `parseSemanticId`.

## Adding a sandbox model

1. Export GLB (Y-up, meters) with named nodes and `semantic_id`, `source_ref`, `confidence` extras.
2. Place it under `public/models/`.
3. Open `/viewer?model=/models/<path>.glb`.

## Test hook

`window.__viewer` (set by `ModelScene`): `getCameraPosition()`, `getTarget()`, `getSelected()`, `getNodeScreenPoint(name)`, `selectNode(name)`. Used by `tests/web/viewer-smoke.spec.ts` where direct canvas clicks are not reliable.
