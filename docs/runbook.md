# Runbook — Močire apartment selector

Read `reports/progress.md` for status, `docs/workflow-gates.md` for pass criteria, and `docs/BUILD-PLAN.md` for the proposed flow. The existing `/viewer` route is a synthetic 3D sandbox. Its tests and setup reports do not demonstrate a Močire selection route.

## 1. Check the web scaffold

Run from the repository root:

```sh
npm ci                     # first install or after a lockfile change
npm run lint
npm run typecheck
npm run test
npm run build
```

For GATE 1 record each command, exit status and output (including the build route table) in `reports/progress.md`. `npm run dev` serves the development scaffold; `npm run start` serves a completed production build. `scripts/doctor.sh` is a broader machine diagnostic; its Blender and media-tool checks are not web prerequisites.

## 2. Check the local source and rights

Use `docs/source-inventory.md` to locate the Sigma inputs. From the root, the following read-only checks compare each unit with its floor listing and show how to verify an image against its sidecar:

```sh
node <<'JS'
const {floors} = require('./assets/source/mocire-zadar-h/inventory.json');
const {units} = require('./assets/geometry/apartments.json');
const unmatched = units.filter(u => !floors.some(f => f.level === u.level &&
  f.units.some(s => s.label === u.unit_id && s.detail_url === u.source_ref)));
console.log({records: units.length, unmatched: unmatched.map(u => u.unit_id)});
if (unmatched.length) process.exitCode = 1;
JS
shasum -a 256 assets/source/mocire-zadar-h/raw/floor-etaza-2.png
cat assets/source/mocire-zadar-h/raw/floor-etaza-2.png.provenance.json
```

Compare the hash to `sha256` in that sidecar; repeat for the actual assets in scope. Check the reverse join for missing scoped records, duplicate keys and each displayed value. These checks do not confer rights. Open and identify the actual local exterior, record permissions for art and overlay separately, and label local-only vs. cleared-for-release per asset. A remote candidate URL cannot pass GATE 2. Keep sources, private review proofs and clearance records out of the public build.

## 3. Review overlay proofs before building the flow

For each exterior and plan image, review the matching registration against its exact version at native size, 1440×900 and 390×844. Compare `{image, level}` or `{image, level, unit_id}` with the GATE 2 ledger. Record the bounds, duplicate/missing/invalid counts and signed list-only exceptions per image. Check target placement after fitting or cropping, including each L04 plan separately. Use only authorized Močire H input; a sandbox mesh, guessed polygon or generic illustration cannot resolve a missing registration.

The image-space validator is **planned**. Until it exists, record reproducible inventory comparisons, annotated review results and the precise input paths. The old metric tools under `scripts/validate/` check a different contract. Wait for GATE 3 sign-off before implementing the final building experience.

## 4. Browser checks for the private selector

The root `npm run test:e2e` still discovers only the synthetic `/viewer` sandbox. It is not evidence for the Močire preview. Run the private selector checks from the repository root with the verified local source snapshot present:

```sh
npm run dev:exterior                 # in another terminal; loopback only
npx --no-install playwright test -c tests/web/stage6-selector.config.ts
PW_REDUCED_MOTION=1 npx --no-install playwright test -c tests/web/stage6-selector.config.ts
npm run test:e2e:exterior
npx --no-install playwright test -c tests/web/floor-plan-proof.config.ts
npx --no-install playwright test -c tests/web/apartment-detail.config.ts
node scripts/validate/audit-mocire-accessibility.mjs
node scripts/validate/profile-mocire-selector.mjs
```

To preserve earlier captures when rerunning the Stage 3–5 suites, set `MOCIRE_QA_CAPTURE_ROOT` to a subdirectory of `reports/qa/stage2/private/`. Keep all Močire artwork captures in that ignored directory.

Start on the [private exterior](http://127.0.0.1:3103/exterior-preview), select a floor from the list, then choose **Provjeri tlocrt**. Verify apartment polygons, cards and room schedules against the source; repeat with keyboard, browser Back/Forward, cold deep links, missing images and reduced motion. The exterior stays list-only until it has an approved floor key. The profiling script measures the local development preview, not production Web Vitals. Review any incomplete axe rules and check assistive technology before release.

Verify that the production build does **not** expose the preview. Run `npm run build`, start `MOCIRE_EXTERIOR_PREVIEW=1 ./node_modules/.bin/next start --hostname 127.0.0.1 --port 3214` in a separate terminal, and run `node tests/web/stage6-production-audit.mjs`. The private endpoints must all return 404 even with the preview flag set.

## 5. Make a gate decision

| In order | Evidence to record |
|---|---|
| 1 Web baseline | `reports/progress.md` |
| 2 Source & rights | `reports/gate2-source-rights.md` |
| 3 Overlay geometry | `reports/gate3-overlay-geometry.md` |
| 4 Selection flow | `reports/qa/gate4-selection-flow.md` |
| 5 Release assets & data | `reports/gate5-release-assets-data.md` |
| 6 Quality | `reports/qa/gate6-quality.md` |

GATES 2–6 reports are outputs to produce, not existing proof. Link each completed report from `reports/progress.md`. For GATE 5 compare the release build and its network requests against the local release manifest. For GATE 6 attach device/motion/accessibility results, console diagnostics and unresolved findings. Record blockers at the first unmet gate.

## Maintainer references

- `docs/agent-orchestration.md` defines current ownership. Ask the integration owner for changes outside an assignment; historical setup fragments are not an integration queue.
- `docs/model-routing.md` records model discovery and its limitations. Role prompts use names, not model IDs.
- For local role diagnostics use `~/.opencode/bin/opencode agent list` or, for example, `~/.opencode/bin/opencode debug agent geometry-extractor`. The historical `Database is not empty and has no session table` issue and scratch `XDG_DATA_HOME` workaround are recorded in `reports/setup-E-infra.md`; do not delete the user's database.
- `docs/blender-pipeline.md` and `reports/setup-A-blender.md` preserve the sandbox setup. A separate, explicitly justified exterior still needs verified, rights-cleared input. There is no modeling, filming or video job in the gate sequence.
