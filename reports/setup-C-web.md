# Agent C: web viewer setup report

Date: 2026-11-23. Machine: macOS 26.6 arm64, Node v23.11.0, npm 10.9.2.

## Versions installed

| Package | Version | Note |
|---|---|---|
| next | 16.4.6 | App Router, `cacheComponents` on |
| react / react-dom | 19.3.0 | |
| three | 0.187.0 | |
| @react-three/fiber | 9.8.2 | |
| @react-three/drei | 10.7.9 | |
| gsap | 3.15.1 | `@gsap/react` was dropped (unused) |
| tailwindcss | 4.3.3 | |
| shadcn (CLI, dev) | 4.23.0 | components: button, card, slider, skeleton |
| vitest | 3.2.7 | Pinned: vitest 4.x crashes npm 10.9.2 with `Cannot read properties of null (reading 'edgesOut')` |
| @playwright/test | 1.65.1 | Chromium 1255 installed |
| @gltf-transform/core | 4.5.1 | placeholder GLB generator |

## Commands and results

- `npm run lint`: exit 0, no problems. The ESLint config ignores other agents' folders (`video/**`, `assets/**`, `scripts/**`, `.venv-bim/**`, `public/models/**`, `public/media/**`, `.opencode/**`). `.opencode/**` is ignored because `threejs-model-optimize/scripts/optimize.mjs` is vendored upstream code and triggers a `next/no-assign-module-variable` error.
- `npm run typecheck`: exit 0.
- `npm run test`: 4 files, 18 tests passed.
- `npm run build`: compiled; routes `/` (static), `/viewer` (partial prerender).
- Dev server: `npm run dev` running on http://localhost:3000. Checked: `/viewer` 200, `/` 200, `/models/test/placeholder-building.glb` 200 (`Accept-Ranges: bytes`), `/viewer/poster.svg` 200.
- `npx playwright test -c tests/web/viewer-smoke.config.ts`: 4 passed (desktop 1440x900 and mobile 390x844 Chrome emulation).

## Components

| Component | Status | Evidence | Files |
|---|---|---|---|
| Next.js scaffold (App Router, TS, Tailwind, ESLint, src/, @/*) | VERIFIED | `npm run build` passes | `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `src/app/*` |
| Dependencies (three, R3F, drei, gsap, Playwright, vitest) | VERIFIED | `npm ls` shows the versions above | `package.json`, `package-lock.json` |
| shadcn/ui | VERIFIED | `shadcn init -d` + `add button card slider skeleton`; `npm run build` passes | `components.json`, `src/components/ui/*`, `src/lib/utils.ts` |
| Scripts (dev/build/start/lint/typecheck/test/test:e2e) | VERIFIED | `npm pkg get scripts` output above | `package.json` |
| Viewer route `/viewer` with `?model=` (same-origin `/models/*.glb` only) | VERIFIED | Smoke test loads placeholder; unit tests for URL allow-list; `/viewer?model=…does-not-exist.glb` shows the error state | `src/app/viewer/page.tsx`, `src/lib/viewer/model-url.ts` |
| R3F Canvas + GLB via `useGLTF` | VERIFIED | Smoke test: model rendered, node picked, overlay shows node name | `src/components/viewer/ModelScene.tsx`, `SceneViewer.tsx` |
| Object picking + overlay (semantic_id, custom properties) | VERIFIED (partial coverage) | Click on projected point selects a node; overlay `semantic-id` equals `window.__viewer.getSelected()`. See caveat below | `Picker.tsx`, `ModelScene.tsx` |
| Lighting, shadows, ACES tone mapping | VERIFIED (code + build); visual check by screenshot | Hemisphere + directional with shadow map, `shadows` on Canvas, ACES via Canvas `gl` prop; screenshot shows shaded faces | `ModelScene.tsx`, `SceneViewer.tsx` |
| GSAP fly-to (1.2 s, `power2.inOut`) | VERIFIED | Probe: camera moved 0.07 units in first 250 ms, 22.95 after; easing matches `power2.inOut` | `CameraRig.tsx`, `lib/viewer/camera.ts` |
| Reduced-motion snap | VERIFIED | Probe with `reducedMotion: "reduce"`: drift after 100 ms = 0.0000 | `CameraRig.tsx`, `lib/viewer/reduced-motion.ts` |
| Adaptive rendering (PerformanceMonitor + AdaptiveDpr, dpr [1,2]) | PARTIAL | Components mounted; not measured. No FPS/frame-time test run yet | `ModelScene.tsx`, `SceneViewer.tsx` |
| Loading state (skeleton, fixed aspect ratio) | VERIFIED | `data-state` goes `loading` → `ready`; skeleton in `viewer-loading` | `SceneViewer.tsx` |
| Error state (GLB 404 / fetch failure) | VERIFIED | Smoke test "does not exist" passes on desktop and mobile; Canvas is not mounted until the HEAD probe passes; error boundary as second line | `SceneViewer.tsx`, `ViewerErrorBoundary.tsx` |
| Mobile fallback (no WebGL → static poster) | PARTIAL | Code path + `public/viewer/poster.svg` (200). Not tested by forcing WebGL off | `SceneViewer.tsx`, `public/viewer/poster.svg` |
| Semantic-ID parser | VERIFIED | 5 unit tests | `src/lib/semantic-id.ts`, `tests/unit/semantic-id.test.ts` |
| Camera math | VERIFIED | 7 unit tests (centre, radius, fov fit, degenerate bounds) | `src/lib/viewer/camera.ts`, `tests/unit/camera.test.ts` |
| Reduced-motion logic | VERIFIED | 3 unit tests + browser probe | `src/lib/viewer/reduced-motion.ts`, `tests/unit/reduced-motion.test.ts` |
| Placeholder GLB generator (idempotent) | VERIFIED | Two runs produce identical 31,836-byte output; 25 nodes named per convention, `semantic_id`/`source_ref`/`confidence` extras | `scripts/web/make-placeholder-glb.mjs`, `public/models/test/placeholder-building.glb` |
| Design system tokens | VERIFIED (build); visual review pending | `:root` palette, motion tokens, reduced-motion CSS rule, `:focus-visible` ring; Inter + Fraunces via `next/font/google` | `src/app/globals.css`, `src/app/layout.tsx`, `docs/design-system.md` |
| Responsive layout | VERIFIED (desktop + mobile screenshots) | `reports/screenshots/viewer-{desktop,mobile}-*.png` | `src/app/viewer/page.tsx`, `SceneViewer.tsx` |
| MCP fragment: Context7 | VERIFIED (initialize response) | `npx -y @upstash/context7-mcp@4.7.3` answered `initialize` with serverInfo `Context7 4.7.3` | `reports/fragments/C-mcp.json` |
| MCP fragment: shadcn | VERIFIED (initialize response) | `npx -y shadcn@latest mcp` answered `initialize`, serverInfo `shadcn 1.0.0` | `reports/fragments/C-mcp.json` |
| Third-party skills (threejs-*, frontend-design, vercel-*) | PARTIAL | Copied from upstream at pinned commits; frontmatter checked. OpenCode discovery NOT verified (see below) | `.opencode/skills/*` |
| OpenCode skill discovery (`opencode debug skill`) | BLOCKED | Fails with `Database is not empty and has no session table` (also with `--pure`). Shared DB `~/.local/share/opencode/opencode.db` is not mine to modify, so I did not touch it | none |

## Skill sources (commit hashes)

- emiliodominguez/threejs-skills @ `ac4464c88ea395fc7df938de8db912b81d18c768`: 27 `threejs-*` folders copied. The umbrella `threejs` skill was not copied.
- anthropics/skills @ `e4bb5d960d87126ff3b3a8af1a104b7db67560ba`: `frontend-design` only.
- vercel-labs/agent-skills @ `5a37a6329fbad3666c3207392a6a7c0110e92efb`: `react-best-practices` → `.opencode/skills/vercel-react-best-practices/`, and `web-design-guidelines` → `.opencode/skills/vercel-web-design-guidelines/`. The frontmatter `name` of the latter is `web-design-guidelines`, which OpenCode may register under that name rather than the directory name.

Install paths: the upstream READMEs recommend `npx skills@1 add <repo>`, which installs globally. I copied the folders directly into `.opencode/skills/` instead, for project scope.

## Caveats and known limits

1. **Picking coverage.** The smoke test picks `B01__L00__U101__wall__003` by clicking its projected centre. The screenshot shows the click selected `B01__L02__NONE__roof__001` instead, because the roof occludes that point from the default camera. The test passes because it asserts the overlay matches the viewer's own selection, not that the specific wall was picked. Picking works; the test does not prove that one node specifically.
2. **OpenCode skill discovery is unverified.** I have not confirmed that OpenCode lists the skills. The folder layout and frontmatter are correct, but the discovery command fails for a reason outside this project.
3. **Adaptive rendering and mobile poster fallback are not measured** (no FPS run, no forced no-WebGL test).
4. **Playwright config.** `tests/web/viewer-smoke.config.ts` is a standalone config for my smoke spec. Agent E owns `playwright.config.ts`; `npm run test:e2e` runs `playwright test` with no root config, so E's config must cover `tests/web/`.
5. **`opencode.jsonc` not edited.** Only `reports/fragments/C-mcp.json` is written; the orchestrator merges it.
6. **Dependency workaround.** vitest is pinned to 3.2.7 because 4.x crashes npm 10.9.2 during install.
7. `.gitignore` was extended with `test-results/` and `playwright-report/`.

## Commands to reproduce

```
cd /Users/enzokutic/realestate2
npm install
npm run dev                  # http://localhost:3000/viewer
npm run lint && npm run typecheck && npm run test && npm run build
npx playwright test -c tests/web/viewer-smoke.config.ts
node scripts/web/make-placeholder-glb.mjs
```

## Screenshots

- `reports/screenshots/viewer-desktop-loaded.png`
- `reports/screenshots/viewer-desktop-selected.png`
- `reports/screenshots/viewer-mobile-loaded.png`
- `reports/screenshots/viewer-mobile-selected.png`

## Files owned and written by Agent C

`package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `next-env.d.ts`, `components.json`, `vitest.config.mts`, `.gitignore`, `src/**`, `public/viewer/poster.svg`, `public/models/test/placeholder-building.glb`, `scripts/web/make-placeholder-glb.mjs`, `tests/unit/**`, `tests/web/**`, `docs/design-system.md`, `docs/web-viewer.md`, `reports/setup-C-web.md`, `reports/fragments/C-mcp.json`, `reports/screenshots/viewer-*.png`, `.opencode/skills/{threejs-*,frontend-design,vercel-*}/**`.
