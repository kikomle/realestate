---
name: visual-regression-and-performance
description: Visual, interaction, and performance QA for the interactive 3D viewer via Playwright (desktop 1440x900, mobile 390x844). Use when checking viewer screenshots, camera transitions, loading state, selection, FPS/frame time, or object identity.
---

# Visual regression and performance

## INPUT

- A running app at `http://localhost:3000` (start with `npm run dev`, or let `playwright.config.ts` start it).
- The viewer route `/viewer` and the test hooks listed in `tests/visual/viewer.spec.ts`:
  `viewer-loading`, `viewer-ready`, `viewer-camera`, `viewer-pick-first-mesh`, `viewer-selected`, `viewer-focus-selected`.
- Optional: `PW_REDUCED_MOTION=1` to run with `reducedMotion: reduce`.

## PROCEDURE

1. Run the suite across both projects (desktop and mobile):
   `npx playwright test tests/visual/viewer.spec.ts`
2. For ad hoc checks, use the official CLI skill `.opencode/skills/playwright-cli/SKILL.md`:
   `playwright-cli open http://localhost:3000/viewer` then `playwright-cli screenshot --filename=reports/qa/<name>.png`.
3. Camera transitions: capture the `viewer-camera` `data-position` attribute before and after `viewer-focus-selected`. The position must change.
4. Loading: the `viewer-loading` element must be visible before `viewer-ready` is attached, then hidden.
5. Interaction: `viewer-pick-first-mesh` must populate `viewer-selected` with a non-empty object name in the `B01__L03__U07__wall__001` naming form.
6. Performance: in the viewer, sample `requestAnimationFrame` for 3 seconds and report average FPS and p95 frame time. Run Lighthouse or Web Vitals only when the built app is served (`npm run build && npm run start`), not against the dev server.
7. Object identity: confirm that each selected object's `semantic_id` matches its name, and that `source_ref` is present (`UNKNOWN` allowed).

## VALIDATION

A run passes only when all of the following hold:
- No console errors (`consoleErrors` is empty in `viewer.spec.ts`).
- Screenshots exist in `reports/qa/` for desktop and mobile (`viewer-loading-*.png`, `viewer-initial-*.png`, `viewer-selected-*.png`).
- Camera position changes after focus.
- Average FPS is at least 30 on the target machine, with the figure recorded.
- Selected object names match the naming contract.

## OUTPUT

Write `reports/qa/visual-report-<date>.md` with:
- a table of check, project, verdict, and evidence path,
- the exact command and its exit code,
- FPS and frame-time numbers,
- severity-ordered findings.

## FAILURE RECOVERY

- **Dev server fails to start**: check the `npm run dev` output. Do not rely on `reuseExistingServer` to hide an unrelated server on port 3000.
- **Test hook not found**: report it as a missing contract. Do not add hooks to `src/` (owned by `web-3d-builder`); return the request to the orchestrator.
- **Flaky screenshot**: rerun with `PW_REDUCED_MOTION=1` to remove animation noise, then compare again. Record both runs.
- **Console errors from third-party code**: record the message and mark it as a finding. Do not suppress it in the test.
- **Trace needed**: rerun with `--trace on` and open `npx playwright show-trace test-results/<dir>/trace.zip`.
- Never edit source or tests to make a failing check pass. Report the failure.
