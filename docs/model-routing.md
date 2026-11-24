# Model routing

`opencode.jsonc` controls live model choice. This table records the routing decision; `.opencode/agents/*.md` reference roles by name only. The Močire image-first workflow reuses the existing IDs.

Verified against `opencode models anonrouter --verbose` on 2026-11-23: 253 IDs under provider `anonrouter`. In OpenCode the full reference is `anonrouter/<id>`, for example `anonrouter/openai/gpt-6-luna`. Verified with `opencode debug agent <name>`, which resolves `providerID: anonrouter`, `modelID: <id>`.

## Routing table

| Role (agent) | Model ID (verified) | Reason | Cost tier |
|---|---|---|---|
| orchestrator (`orchestrator-architect`) | `openai/gpt-5.6-sol-pro` | Strongest verified reasoning in the list. Gate decisions, delegation, and escalation. | High |
| blender_geometry (`blender-builder`) | `openai/gpt-6-luna` | Conditional: an explicitly justified exterior still from verified, rights-cleared input. Generator scripting is its historical assignment. | High |
| web_complex (`web-3d-builder`) | `openai/gpt-6.1-sol` | Next.js, GSAP and accessible SVG selection. Closest verified match to the requested "GPT-6.2 Sol"; `/viewer` remains a synthetic sandbox. | High |
| geometry extraction (`geometry-extractor`) | `anthropic/claude-sonnet-5.5` | Source records and image-space registration data for exterior → floor and plan → unit. Metric extraction is a separate optional track. Image input NOT verified (see below). | Medium |
| repetitive / boilerplate (`doc-scribe`) | `deepseek/deepseek-v4.1-flash` | Cheap, high-volume docs and boilerplate. | Low |
| pdf_visual_interpretation | NONE VERIFIED | No anonrouter model is verified to accept image input. Blocked; see below. | n/a |
| visual_qa (`visual-qa-reviewer`) | `google/gemini-3.8-flash` | Selection, accessibility and responsive overlay QA from deterministic checks and text results. Image input NOT verified; use human visual sign-off where needed. | Medium |
| cinematic_video | NOT AN LLM ROUTE | Archived (`docs/video-model-selection.md`); the setup survey found no video model on anonrouter. No cinematic delegation or video jobs in this workflow. | n/a |

Setup history: `reports/setup-E-infra.md` records the original discovery and `reports/fragments/E-model-routing.json` is its archived fragment, not an input to merge. It uses the `agents` key. OpenCode 1.19.5 resolves both `agent` and `agents`; the docs describe `agents`.

## Requested-model discrepancies

| Requested | Status | Closest verified ID |
|---|---|---|
| GPT-6.2 Sol xhigh | NOT PRESENT | `openai/gpt-6.1-sol` (also present: `openai/gpt-6-sol`, `openai/gpt-6.1-sol-ultrafast`) |
| openai/gpt-6-luna | PRESENT | — |
| openai/gpt-6-sol | PRESENT | — |
| openai/gpt-6.1-sol | PRESENT | — |
| openai/gpt-6-astra-pro | PRESENT | — |
| openai/gpt-5.6-sol-pro | PRESENT | — |
| anthropic/claude-opus-5.5 | PRESENT | — |
| anthropic/claude-sonnet-5.5 | PRESENT | — |
| anthropic/claude-fable-5.2 | PRESENT | — |
| deepseek/deepseek-v4.1-flash | PRESENT | — |
| google/gemini-3.8-flash | PRESENT | — |
| moonshotai/kimi-k3.1-pro | PRESENT | — |
| qwen/qwen-3.8-omni-flash | PRESENT | — |
| deepseek/deepseek-v4.1-flash-vision-exp | NOT PRESENT | `deepseek/deepseek-v4-flash-vision-exp` |

## Verified gaps

1. **Image input is not verifiable from metadata.** Every anonrouter model reports `capabilities.input` = text only, including `-vl` and `-vision` names (for example `qwen/qwen3-vl-235b`, `z-ai/glm-5v-turbo`, `deepseek/deepseek-v4-flash-vision-exp`). So `pdf_visual_interpretation` and `visual_qa` have no verified multimodal route. Confirming it needs one real image request, which costs credits, so it is blocked until the user authorizes that test.
2. **Reasoning effort ("xhigh") is not exposed.** No anonrouter model reports `reasoning: true` and none has `variants`. Only `anonrouter/*` routing IDs exist for effort, and they are not verified. Do not write `#xhigh` anywhere.
3. **Cost tiers are not in metadata.** Every model reports cost 0. The tiers in the table above are judgment based on model class, not pricing data.

## Rules

- Escalate to `orchestrator` tier only for gate decisions and cross-agent conflicts. See `docs/agent-orchestration.md`.
- Never hardcode a model ID in `.opencode/agents/*.md` or in code.
- Re-verify IDs with `opencode models anonrouter` before changing any route, because the provider list changes.
- The `-fast`, `-ultrafast`, `-pro`, and `:free` variants are different routes with different cost and quality. Do not swap them in silently.
