# Setup B: HyperFrames video environment

Date: 2026-11-23. Owner: Agent B. All results below come from commands run in this session.

## Component status

| Component | Status | Evidence | Files |
|---|---|---|---|
| Node ≥22 | VERIFIED | `node -v` → v23.11.0 | — |
| FFmpeg / FFprobe | VERIFIED | `ffmpeg -version` 9.0.2; ffprobe used on all outputs | /opt/homebrew/bin |
| HyperFrames CLI 0.9.85 (project-local) | VERIFIED | `npx hyperframes --version` → 0.9.85; `doctor` passes FFmpeg, FFprobe, Chrome | video/package.json, video/package-lock.json |
| HyperFrames doctor | PARTIAL | Optional items missing: whisper-cpp, Kokoro TTS, MusicGen BGM, Docker not running | doctor output |
| Lint of all compositions | VERIFIED | `hyperframes lint` → 0 errors, 0 warnings on 6 compositions | video/compositions/*.html |
| Smoke render landscape 1920x1080 | VERIFIED | ffprobe: h264, 1920x1080, 30/1 fps, 180 frames, 6.000 s; frame at 3 s shows title | public/media/video/smoke/smoke-landscape.mp4 |
| Smoke render portrait 1080x1920 | VERIFIED | ffprobe: h264, 1080x1920, 30/1 fps, 180 frames, 6.000 s | public/media/video/smoke/smoke-portrait.mp4 |
| Vendored GSAP (no CDN at render) | VERIFIED | npm gsap 3.15.0 copied to vendor | video/vendor/gsap.min.js |
| Global HyperFrames skills (6) | VERIFIED present, PARTIAL current | Symlinks to ~/.claude/skills (official heygen-com repo); `skills check`: 6 outdated, 3 missing. Not updated (outside project). | ~/.config/opencode/skills/* |
| HyperFrames MCP | DECISION: CLI, no MCP | Hosted connector only, no local project/render; see docs/hyperframes-workflow.md | (no fragment) |
| Templates (4) | VERIFIED | Each builds from example data and lints clean (4/4) | video/templates/*.html, scripts/video/data/*.example.json |
| Template build script + tests | VERIFIED | `node --test scripts/video/build-composition.test.mjs` → 2 pass | scripts/video/build-composition.mjs |
| Provider abstraction + tests | VERIFIED (dry_run only) | `node --test scripts/video/providers/provider.test.mjs` → 5 pass; dry_run writes manifest with reference constraints | scripts/video/providers/*.mjs |
| anonrouter provider | NOT TESTED live; disabled by default | Refuses unless VIDEO_ANONROUTER_ENABLED=1 and key in env. No live call made. | scripts/video/providers/anonrouter.mjs |
| local_comfyui provider | NOT TESTED live; disabled by default | Refuses unless VIDEO_LOCAL_COMFYUI=1; ComfyUI not reachable (`curl 127.0.0.1:8188` → 000). Video workflow not implemented. | scripts/video/providers/local-comfyui.mjs |
| Shot specs + schema | VERIFIED | 5 shots validate against shot.schema.json (jsonschema) | docs/shots/*.json, docs/shots/shot.schema.json |
| Skill: cinematic-camera-direction | VERIFIED (files exist, referenced paths exist) | Five-section structure | .opencode/skills/cinematic-camera-direction/SKILL.md |
| Skill: architectural-video-production | VERIFIED (files exist, referenced paths exist) | Five-section structure | .opencode/skills/architectural-video-production/SKILL.md |
| Video model research | PARTIAL | Verified candidates from vendor/aggregator pages; no live API call; no model ID verified against a live endpoint | docs/video-model-selection.md |
| anonrouter video models | VERIFIED: none present | Regex over 253 models: only text LLMs matched | docs/video-model-selection.md |
| ComfyUI local | BLOCKED (not running) | HTTP 000 on 127.0.0.1:8188 | — |

## Smoke-render ffprobe output (exact)

landscape (public/media/video/smoke/smoke-landscape.mp4):
```
codec_name=h264
width=1920
height=1080
r_frame_rate=30/1
nb_read_frames=180
duration=6.000000
```
portrait (public/media/video/smoke/smoke-portrait.mp4):
```
codec_name=h264
width=1080
height=1920
r_frame_rate=30/1
nb_read_frames=180
duration=6.000000
```

## Video model candidates (verified as published, not live-tested)
- Seedance 2.5 (ByteDance): image-to-video with first frame, 4–30 s, $0.68/s at 1080p (Runway Dev, 2026-11-16).
- Wan 3.0 (Alibaba): first frame, 2–30 s, $0.10/s at 720p, $0.20/s at 1080p (WaveSpeed, 2026-11-16).
- Kling 4.0 (Kling): first frame plus up to 10 keyframes, up to 30 s (Kling API updates, 2026-11-19).
- Veo 3.1 (Google): first and last frame, 4/6/8 s, $0.40/s with audio (Runway Dev).
- Gemini Omni 1.2 Flash (Google): 3–15 s, $0.023/s at 360p (aggregator). Veo 3.1 Lite in the Gemini API was shut down 2026-10-22 per one source.

## Remaining user actions
1. Paid video generation needs explicit authorization and a key. Set `ANONROUTER_API_KEY` (or a vendor key) in env only. anonrouter currently lists no video model.
2. Start ComfyUI at 127.0.0.1:8188 and build an i2v workflow if a free local option is wanted.
3. Optional: `npx hyperframes skills update` in ~/.claude/skills to bring the six global skills up to date (not run by Agent B).
4. Optional: start Docker if `--docker` deterministic renders are wanted. Not needed for the local render.
5. Optional: install whisper-cpp (`brew install whisper-cpp`) for transcription.

## Notes
- Placeholder plates in video/assets/placeholder/ are generated test patterns, not architectural assets.
- The reference still public/media/images/placeholder/transition-reference.png is a generated gradient placeholder.
- Intermediate renders are in video/renders/ (not published). Published files are only under public/media/.
- No root-level files were edited. No MCP config was added, so reports/fragments/ contains no B-hyperframes-mcp.json.
