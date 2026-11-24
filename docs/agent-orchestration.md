# Agent orchestration

Use the existing role names for the Močire image-first selector. The setup notes below explain the original configuration; the ownership table governs current work.

## 1. Verified OpenCode 1.19.5 conventions

Verified 2026-11-23 with `~/.opencode/bin/opencode` 1.19.5, `opencode agent list`, `opencode debug agent <name>`, `opencode debug skill`, and the official docs at opencode.ai/docs (agents, config, skills, mcp-servers).

**Agents**
- Markdown agents live in `.opencode/agents/<name>.md` (project) or `~/.config/opencode/agents/` (global). Nested paths become IDs: `team/x.md` → `team/x`.
- Frontmatter fields: `description`, `mode` (`primary` | `subagent` | `all`), `model` (`provider/model` with optional `#variant`), `permissions`, `hidden`, `disabled`, `steps`, `color`. The Markdown body becomes the system prompt.
- Permissions are an ordered list of `{action, resource, effect}`. `effect` is `allow` | `ask` | `deny`. The last matching rule wins, so broad rules go first.
- The V1 keys `permission`, `tools`, `prompt`, `temperature`, `maxSteps` are deprecated for V2. This project uses the list form.
- `subagent` mode agents run in child sessions. A parent may launch them only if its `subagent` permission allows that agent ID (see `orchestrator-architect.md`).
- At setup, `opencode agent list` showed seven role definitions. A retained Markdown file does not make a role an active delegation target.

**Model in agent config**
- Live routing is in `opencode.jsonc`. The setup-era routing fragment is archived; use `docs/model-routing.md` for the discovery record.
- Model IDs must carry the provider prefix: `anonrouter/<id>`. Verified: `anonrouter/anthropic/claude-opus-5.5` resolves to `providerID: anonrouter, modelID: anthropic/claude-opus-5.5`. A bare `anthropic/...` resolves to the wrong provider.
- The `agent` and `agents` keys are both accepted by 1.19.5. The docs use `agents`.

**Config files**
- Precedence (low → high): `~/.config/opencode/opencode.json(c)`, project `opencode.json(c)` files walking up from the cwd, `.opencode/opencode.json(c)`, then `/Library/Application Support/opencode`.
- JSONC with comments and trailing commas is allowed. The global file is plain JSON.
- `{env:NAME}` substitution works in strings. Never put secrets in the file.

**Skills**
- Discovered at `.opencode/skills/<id>/SKILL.md` (project) and `~/.config/opencode/skills/<id>/SKILL.md` (global). Compatibility paths `.claude/skills` and `.agents/skills` are also read.
- The skill ID is the directory name. The frontmatter `name` is only a display label.
- Only skills with a `description` are advertised to the model.
- Verified: `opencode debug skill` lists `playwright-cli` from `/Users/enzokutic/realestate2/.opencode/skills/playwright-cli/SKILL.md`.

**MCP**
- Config goes under `mcp.servers.<name>` (current docs). The global config uses the older flat `mcp.<name>` form, which the CLI also reads (`debug config` shows it).
- Local servers take `type: "local"`, `command` as an array, and optional `environment`, `cwd`, `disabled`. Use `disabled`, not `enabled`.
- Tools are exposed as `<server>_<tool>`. Under Code Mode they appear as `tools.<server>.<tool>(...)`.
- `opencode mcp list` needs a working OpenCode DB. See the runbook for the workaround.

**Known environment issue (verified)**
- `opencode models`, `opencode agent list`, `opencode debug skill`, and `opencode mcp list` fail with "Database is not empty and has no session table" against the user's default `~/.local/share/opencode/opencode.db`. Setting `XDG_DATA_HOME` to a scratch directory makes every command work. The default DB was NOT modified. The orchestrator should decide whether to repair or move it.

## 2. Current ownership

The **integration owner** is the primary maintainer/session accepting changes, not another agent ID. It owns `AGENTS.md`, `opencode.jsonc`, `reports/progress.md`, shared infra (including package scripts, role prompts, CI, test configuration, tests and validators), source/rights intake, release promotion and the workflow docs. It issues explicit path assignments and integrates gate evidence. The `orchestrator-architect` role coordinates; it does not implement changes or grant publication rights.

| Role | Write scope when assigned | Current responsibility |
|---|---|---|
| `orchestrator-architect` | None | Check evidence in order, identify blockers, give the relevant owner a scoped brief. |
| `geometry-extractor` | `assets/geometry/**` | Join sourced unit facts, register approved exterior → floor and floor-plan → unit overlays in image space. Report missing inputs to the integration owner. Metric work is optional and separate. |
| `web-3d-builder` | `src/**` | After GATE 3, implement Next.js/GSAP/SVG selection, accessible text links and source-only APARTMENT details. `/viewer` remains a synthetic sandbox. |
| `blender-builder` | `assets/blender/**`, `scripts/blender/**` | Only an explicitly justified exterior still from verified, rights-cleared input; no default modeling or export job. |
| `visual-qa-reviewer` | `reports/qa/**` | Exercise the image-first flow and report evidence; send source/test fixes to their owner. Use the 3D visual skill only on an assigned sandbox test. |
| `doc-scribe` | Assigned `docs/**` files | Document current evidence and distinguish intended behavior from implemented routes. Shared workflow docs need an explicit assignment. |
| `cinematic-director` | None | Archived, read-only; not a delegation target. |

**Historical Agent E** set up role prompts, QA tooling, CI, doctor scripts and these workflow docs (`reports/setup-E-infra.md`). Setup authorship is not a continuing exclusive lock or an instruction to merge fragments. The integration owner can explicitly assign an infra maintainer a finite set of files for one task; all other shared paths stay with the integration owner. Never assign the same file to two writers concurrently.

## 3. Handoffs and evidence

1. Read `reports/progress.md` and `docs/workflow-gates.md`. Before GATE 3, source intake and private overlay review may proceed; the final building experience may not. No interior, furnishing, walkthrough, filming or video assignments.
2. In a brief, give the stage, exact input paths and record/image IDs, exclusive write paths, acceptance checks and evidence destination. Resolve inputs against the local inventory and provenance. Missing art, rights or data is a blocker or a documented missing value, not an invitation to substitute sandbox assets.
3. Prefer deterministic checks: scaffold scripts at GATE 1; inventory joins and per-image coverage/registration checks for GATES 2–3; actual selector tests and release audits later. `docs/runbook.md` identifies planned checks and the root Playwright blocker.
4. Return changed paths, commands and output, remaining exceptions/blockers and exact evidence references. If a needed edit is outside your paths, hand it to the integration owner. Only the integration owner updates the decision log; a worker's proposed pass is not a gate decision.
5. Escalate on a gate decision, conflicting evidence or a failed check that a cheaper retry did not resolve (`docs/model-routing.md`). Paid API requests, including image-input probes, require explicit user authorization.
