# AGENTS.md — Persistent Rules

Project: Močire Zadar H apartment selector. Follow `docs/BUILD-PLAN.md` and check `reports/progress.md` before assigning work.
Source: [Sigma](https://www.sigma.hr/projekti/mocire-zadar-h/) (local prototype only). Interaction reference: [Kozielska by Vinode](https://kozielska.vinode.io/Kozielska/Zone_A/Kozielska_A1V/2_06?floor=2).

Active scope: **OVERVIEW** (exterior still → floor) → **FLOOR** (2D plan → unit) → **APARTMENT** (sourced details). Use Next.js, GSAP and accessible SVG overlays. Stop interior modeling, furniture research, furnishing, walkthroughs and all video work; preserve existing artifacts. Use Blender/Three.js only for a documented exterior need, never as a dependency of selection.

## Non-negotiable rules

1. Never hardcode API keys. Read secrets from environment variables only.
2. Never claim a component works without a command and its output as evidence.
3. Never invent dimensions, areas, prices, or unit counts. Missing values are `null` with a flag (`MISSING_SOURCE` or `UNKNOWN`).
4. Do not publish third-party architectural assets. Source drawings live in `assets/source/` and never in `public/`.
5. Do not spend paid API credits without explicit user authorization.
6. Do not build the final building experience before GATE 3 (image-space overlay geometry) passes. A synthetic model cannot satisfy this gate.
7. Each agent edits only the paths it owns (see `docs/agent-orchestration.md`).
8. A gate passes only when its evidence file exists (see `docs/workflow-gates.md`).

## Coordinates and identity

SVG coordinates belong to one version of one image. Use its intrinsic pixel dimensions and the same crop/aspect ratio for the art and overlay. Record the image identifier, level and (on a plan) the exact source `unit_id`. Never convert these pixels into metres or advertised areas.

For the retained 3D tools:

- Units: meters. Blender and glTF are Z-up in Blender and Y-up in glTF (exporter converts).
- Origin: south-west ground corner of the complex. X = east, Y = north, Z = up.
- Object names: `{BUILDING}__{LEVEL}__{UNIT}__{TYPE}__{INDEX}`, e.g. `B01__L03__U07__wall__001`.
  - BUILDING `B01`…; LEVEL `L00` ground, `L01`…, basement `LM01`…; UNIT `U101`-style or `NONE`.
  - TYPE: `wall | slab | window | door | balcony | stair | column | roof | site`.
- Custom properties on every object: `semantic_id`, `source_ref` (`UNKNOWN` if not sourced), `confidence` (0–1).

## Gates

GATE 1 Web baseline → GATE 2 Source & rights → GATE 3 Overlay geometry → GATE 4 Selection flow → GATE 5 Release assets & data → GATE 6 Quality.

Details: `docs/workflow-gates.md`.

## Where things live

| Path | Purpose |
|---|---|
| `opencode.jsonc` | OpenCode config: MCP servers, model routing, agents |
| `.opencode/agents/` | Project subagents |
| `.opencode/skills/` | Project and third-party skills |
| `assets/source/` | Source drawings + provenance (local only) |
| `assets/geometry/` | Apartment inventory, overlay data (planned), metric test fixtures |
| `assets/blender/` | Retained Blender assets |
| `public/models/` | Sandbox GLBs and manifest |
| `public/media/` | Approved release imagery; existing smoke media are not production assets |
| `src/` | Next.js application |
| `scripts/` | Automation, validation, setup, `doctor.sh` |
| `tests/` | Geometry, unit, web, visual tests |
| `docs/` | Architecture, workflow, setup, model routing |
| `reports/` | Installation and validation results |

## Commands

- Health check: `scripts/doctor.sh`
- Web dev server: `npm run dev`
- Unit tests: `npm run test`; E2E/visual: `npm run test:e2e`
- Model routing reference: `docs/model-routing.md`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
