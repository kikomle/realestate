# HyperFrames workflow (Agent B)

**Parked indefinitely.** The [selector plan](BUILD-PLAN.md) excludes video and walkthroughs. No gate schedules cinematic work. The following is the archived setup and command reference for the existing smoke compositions.

## Decision: CLI, not the hosted MCP
- Hosted connector: `https://mcp.heygen.com/mcp/hyperframes/` (HeyGen docs, "Create through an AI chat", beta). It renders on HeyGen infrastructure and requires a HeyGen account with connector access. It gives no local project folder, no local render, and no frame-level control.
- We need local, deterministic, editable projects with GSAP timelines and frame-accurate checks. The CLI gives all of that with no account and no paid render.
- Decision: use the local CLI. **No MCP entry is added** to `opencode.jsonc`, and no fragment is written, because the MCP does not add concrete value here.

## Versions (verified)
- `hyperframes` npm package `0.9.85` (latest tag), pinned in `video/package.json`. Requires Node ≥22; installed Node is v23.11.0.
- `gsap` `3.15.0`, vendored at `video/vendor/gsap.min.js`. The scaffold's default CDN script is replaced so renders need no network.
- FFmpeg/FFprobe `9.0.2` (Homebrew).
- Chrome headless shell is downloaded by the CLI into `~/.cache/hyperframes/chrome/`.

## Commands (run from `video/`)
- `npx hyperframes doctor`: environment check.
- `npx hyperframes lint <file>`: lint a composition.
- `npx hyperframes render . -o renders/<name>.mp4 --quality looks --fps 30`: render the project's `index.html`. The argument must be the project folder.
- `npx hyperframes render . --resolution portrait -o <name>.mp4`: portrait render from a portrait composition.

## Skills
- Global skills present at `~/.claude/skills/` (symlinked into `~/.config/opencode/skills/`): `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `reverse-any-video`, `style-sampling`. Sources: the official `heygen-com/hyperframes` repo, per the CLI's `skills check`.
- `npx hyperframes skills check` reports 6 outdated and 3 missing (`figma`, plus two not in use). **Not updated**: the skills live outside this project. User action: `npx hyperframes skills update` if desired.

## Layout
- `video/index.html`: root composition for `render .`.
- `video/compositions/`: smoke and example compositions.
- `video/templates/`: `aerial-reveal`, `facade-flyby`, `architectural-transition`, `typography-title` (placeholders `{{...}}`).
- `video/assets/placeholder/`: generated test plates (not architectural assets).
- `video/renders/`: local renders (not published).
- `public/media/video/smoke/`: published smoke MP4s.
- `scripts/video/data/*.example.json`: example template data.
