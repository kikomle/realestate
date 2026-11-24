# Video model selection (Agent B)

**Parked indefinitely.** The [selector plan](BUILD-PLAN.md) has no video deliverable or cinematic gate. The process and provider checks below are a historical record, not a production schedule or authorization to spend credits.

## Process
1. Each shot is classified in `docs/shots/`. Geometry-sensitive shots use Blender deterministic camera, not AI.
2. AI image-to-video is considered only for atmospheric plates, and only from a Blender reference still.
3. A candidate qualifies only if: (a) it accepts an image as the first frame, (b) it can be called with a verified model ID, (c) its per-second price is known from a current source, and (d) it does not require a paid key for the local dry-run path.
4. Start with `dry_run` (manifest only). Paid calls need explicit user approval (AGENTS.md rule 5).

## Local check of the anonrouter catalog (verified)
Read from `~/.config/opencode/opencode.json` with Python:
- Provider `anonrouter`: 253 models.
- Regex match for `video|i2v|veo|kling|wan|sora|seedance|hailuo|runway|luma|pika|minimax|hunyuan|ltx`: 9 IDs, all text LLMs (`minimax/minimax-m2`, `minimax/minimax-m2.1`, `minimax/minimax-m2.5`, `minimax/minimax-m2.7`, `minimax/minimax-m3`, `minimax/minimax-m3.1-flash`, `thinking-machines/inkling`, `thinking-machines/inkling-small`, `~minimax/minimax-latest`).
- **Result: no video-capable model is present in anonrouter's list.** The anonrouter provider is therefore not a video option today.

## Local ComfyUI (verified)
- MCP entry `comfyui` points at `http://127.0.0.1:8188` with `COMFYUI_DEFAULT_CKPT=RealVisXL_V5.0_fp16.safetensors`.
- Probe `curl http://127.0.0.1:8188/system_stats`: no response (HTTP 000). **Not running at check time.**
- It is a free local option only when running, and the local i2v workflow is not built (see `scripts/video/providers/local-comfyui.mjs`).

## Verified cloud candidates (from vendor/aggregator pages, checked 2026-11-23)
These are not confirmed against a live API by this team. Prices are as published on the cited pages. Model IDs are the ones shown on the cited pages; confirm each before use.

| Model | Vendor | Image-to-video, first frame | Length | Price per second (as published) | Notes for architecture | Source |
|---|---|---|---|---|---|---|
| Seedance 2.5 | ByteDance | Yes (first frame, plus last frame) | 4–30 s | $0.30 at 720p, $0.68 at 1080p (Runway Dev) | Holds first frame well; highest ranked on the Runway Dev i2v leaderboard | runway dev docs, seedance-2-5-api (2026-11-16) |
| Wan 3.0 | Alibaba | Yes (first frame, optional last frame) | 2–30 s | $0.10 at 720p, $0.20 at 1080p (WaveSpeed) | Fixes the first frame; cheaper drafts | wavespeed blog (2026-11-16) |
| Kling 4.0 | Kling | Yes (first frame; up to 10 keyframes) | up to 30 s | 4K/HDR fee added (Kling API update 2026-11-19); rate not restated here | Keyframe control | kling api updates (2026-11-19) |
| Veo 3.1 | Google | Yes (first and last frame) | 4, 6, 8 s | $0.40/s with audio (Runway Dev list) | Short shots | runway dev i2v leaderboard (2026-11-13) |
| Gemini Omni 1.2 Flash | Google | Yes | 3–15 s | $0.023/s at 360p (per aggregator) | Cheapest; short clips | aigrowthkit pricing (2026-11-08) |

## Selection criteria, per shot
- Geometry consistency: Blender deterministic beats all of these. Use AI only for atmospheric plates.
- Reference adherence: prefer first-frame-holding models (Seedance 2.5, Wan 3.0). Keep `reference_constraints` in every shot.
- Camera control: deterministic 3D camera is the only verified control. None of the listed models is verified for camera-path control.
- Cost: draft with Wan 3.0 or Gemini Omni Flash; final with Seedance 2.5 only with approval.

## Not verified here
- No model call was made. No API key was read or used. No cost was incurred.
- Model IDs in the table are display names from vendor pages, not API IDs. Do not wire them into code without checking the provider's own model list.
