# Setup report — Agent E (infra, agents, Playwright, CI)

Date: 2026-11-23. Machine: macOS arm64, Node v23.11.0, Python 3.12.8, OpenCode 1.19.5.

## Component status

| Component | Status | Evidence | Files |
|---|---|---|---|
| OpenCode conventions (agents, config, skills, MCP) | VERIFIED | Official docs fetched; `opencode debug agent`, `opencode debug skill`, `opencode agent list` | `docs/agent-orchestration.md` |
| Model discovery (anonrouter) | VERIFIED | `opencode models anonrouter --verbose` → 253 IDs, parsed | `docs/model-routing.md` |
| Model routing fragment | VERIFIED (parses) | `python3 -c json.load` ok; `opencode debug agent geometry-extractor` resolves `providerID: anonrouter` | `reports/fragments/E-model-routing.json` |
| Project agents (7) | VERIFIED | `opencode agent list` shows all 7 as subagent/primary | `.opencode/agents/*.md` |
| Playwright CLI 0.1.25 + skill | VERIFIED | `playwright-cli open` / `screenshot` / `close` ran; `debug skill` lists `playwright-cli` | `.opencode/skills/playwright-cli/` (11 files) |
| Chromium (playwright 1.65.1) | VERIFIED | `playwright install chromium`; screenshot of example.com rendered | `reports/qa/playwright-smoke.png` |
| playwright.config.ts + viewer spec | PARTIAL | `tsc --noEmit` passes on both files; NOT executed (see blockers) | `playwright.config.ts`, `tests/visual/viewer.spec.ts` |
| Visual skill | VERIFIED (doc) | Skill loads via `debug skill`; references real files | `.opencode/skills/visual-regression-and-performance/SKILL.md` |
| .gitignore / .editorconfig / .prettierrc / .prettierignore | VERIFIED (written) | files exist | root dotfiles |
| CI workflow | VERIFIED (syntax) | `yaml.safe_load` parses; jobs: web, python, doctor | `.github/workflows/ci.yml` |
| scripts/doctor.sh | VERIFIED | `bash -n` ok; run output below (exit 1 due to 1 FAIL) | `scripts/doctor.sh`, `reports/setup-E-doctor.txt` |
| scripts/setup-infra.sh | VERIFIED | Ran: chromium detected, OpenCode 1.19.5, doctor invoked | `scripts/setup-infra.sh` |
| Runbook / workflow gates | VERIFIED (written) | commands checked against installed tools | `docs/runbook.md`, `docs/workflow-gates.md` |
| package.json scripts fragment | VERIFIED (written) | JSON parses | `reports/fragments/E-package-scripts.json` |

## Evidence

### `opencode agent list` (filtered to project agents, 1.19.5)
```
blender-builder (subagent)
cinematic-director (subagent)
doc-scribe (subagent)
geometry-extractor (subagent)
orchestrator-architect (primary)
visual-qa-reviewer (subagent)
web-3d-builder (subagent)
```
Note: the default DB `~/.local/share/opencode/opencode.db` fails for every CLI command ("Database is not empty and has no session table"). All runs above used `XDG_DATA_HOME=/private/var/folders/dk/p_6hkdwx2b72bd4ny3_wj12m0000gn/T/opencode/xdg-data`. The default DB was not modified.

### `scripts/doctor.sh` (run after dev server stopped)
Final summary: **19 PASS, 3 WARN, 1 FAIL** (exit 1). Full output in `reports/setup-E-doctor.txt`. The FAIL is `2 skill(s) missing SKILL.md or name/description` — `architectural-pdf-extraction/` and `architectural-reality-validation/` have no `SKILL.md` yet (owned by agent D). The earlier run with the same checks had 0 FAIL, so this failure is new and not caused by E's files.

### Playwright smoke
`reports/qa/playwright-smoke.png` — example.com rendered (checked visually).

### Routing IDs (verified in list)
| Role | ID |
|---|---|
| orchestrator | openai/gpt-5.6-sol-pro |
| blender_geometry | openai/gpt-6-luna |
| web_complex | openai/gpt-6.1-sol |
| geometry extraction | anthropic/claude-sonnet-5.5 |
| repetitive/boilerplate | deepseek/deepseek-v4.1-flash |
| visual_qa | google/gemini-3.8-flash (image input NOT verified) |
| pdf_visual_interpretation | NONE VERIFIED |

## Discrepancy list (requested models not present or not verifiable)

| Requested | Result |
|---|---|
| GPT-6.2 Sol xhigh | NOT PRESENT. Closest: `openai/gpt-6.1-sol` |
| deepseek/deepseek-v4.1-flash-vision-exp | NOT PRESENT. Closest: `deepseek/deepseek-v4-flash-vision-exp` |
| Image input for any model | NOT VERIFIABLE. All 253 report text-only input, including `-vl`/`-vision` names. Verifying needs a paid request, not run. |
| Reasoning effort "xhigh" variants | NOT EXPOSED. No `reasoning: true` and no `variants` in any model. |
| Cost tiers | NOT IN METADATA. All costs are 0; tiers in routing doc are judgment. |
| All other candidates (gpt-6-luna, gpt-6-sol, gpt-6.1-sol, gpt-6-astra-pro, gpt-5.6-sol-pro, claude-opus-5.5, claude-sonnet-5.5, claude-fable-5.2, deepseek-v4.1-flash, gemini-3.8-flash, kimi-k3.1-pro, qwen-3.8-omni-flash) | PRESENT | — |

## Blockers (not E's to fix)

1. **`/viewer` route returns 404** (verified: `curl http://localhost:3000/viewer` → 404; `/` → 200). `src/app/` has no `viewer` route yet. Agent C must add it.
2. **Test hooks absent.** `tests/visual/viewer.spec.ts` expects `data-testid` values `viewer-loading`, `viewer-ready`, `viewer-camera`, `viewer-pick-first-mesh`, `viewer-selected`, `viewer-focus-selected`. `grep` over `src/` finds none. `docs/web-viewer.md` does not exist yet. The hook contract is in the spec and the skill.
3. **Viewer spec NOT executed.** Blocked by 1 and 2. Expected to run once C adds the route and hooks: `npx playwright test tests/visual/viewer.spec.ts`.
4. **Doctor FAIL** from agent D's two skill directories with no SKILL.md (see above).
5. **`opencode.jsonc` does not exist** (orchestrator owns it). The routing fragment is ready to merge; the MCP check is skipped until it exists.
6. **`npm run test:e2e` and `test:visual`** need the fragment merged into `package.json` (agent C). `@playwright/test` 1.65.1 is already in the dependency tree.
7. **Default OpenCode DB is corrupt for the CLI.** Orchestrator decision: repair or move `~/.local/share/opencode/opencode.db`. Not touched by E.
8. **Blender MCP** is not declared (agent A pending).

## Not done (by design)

- No paid API calls. No image-input test on any anonrouter model (would spend credits without authorization).
- `git init` not run.
- `package.json`, `AGENTS.md`, `opencode.jsonc`, `README.md` not edited.
- Global `~/.config/opencode/opencode.json` not modified.
