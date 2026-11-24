# Setup report: Agent A (Blender / BIM pipeline)

Date: 2026-11-23. Machine: macOS, Apple Silicon (M3 Pro). Every row below is backed by a command that was run in this session.

## Component status

| Component | Status | Evidence (command → result) | Files |
|---|---|---|---|
| Blender 5.3.0 headless | VERIFIED | `Blender -b --factory-startup --python-expr "import bpy; print(bpy.app.version_string)"` → `5.3.0` | — |
| Cycles GPU (Metal) | VERIFIED | `prefs.devices` → `Apple M3 Pro (GPU - 18 cores)` METAL; render log `device METAL` | `scripts/blender/render.py` |
| Blender MCP addon in Blender 5.3 (GUI) | VERIFIED | addon copy identical to bundled `addon.py` (cmp SAME); GUI instance on port 9877 → `GUI_SERVER_RUNNING True` | `~/Library/Application Support/Blender/5.3/scripts/addons/blender_mcp.py` (outside repo) |
| Blender MCP stdio round trip | VERIFIED | `.venv-bim/bin/python scripts/blender/mcp_smoke_client.py` (BLENDER_PORT=9877) → tools list (10) and `get_scene_info` = "Scene 'Scene' … 1 camera, 1 light, 1 mesh" | `scripts/blender/mcp_smoke_client.py` |
| Blender MCP headless server | BLOCKED (by addon design) | `Blender -b` with addon → "cannot start server in background mode … commands would never execute" | — |
| OpenCode `mcp list` with Blender MCP | BLOCKED | `opencode mcp list` → "Database is not empty and has no session table" (fails before reading config; same for the existing `ctx` and `comfyui` entries, so it is an OpenCode state DB issue, not this config) | `reports/fragments/A-blender-mcp.json` |
| Scene generator (2 bldgs × 2 levels × 2 apts) | VERIFIED | `build_test_complex.py` → `BUILD_OK … objects 103`; contract regex rejects bad names (caught `SITE__` once) | `scripts/blender/build_test_complex.py`, `common.py` |
| Materials (PBR + Poly Haven maps) | PARTIAL | Materials build headless; textures loaded from `assets/blender/materials/textures/`. Only the aerial render was inspected | `scripts/blender/materials.py` |
| Lighting + named cameras | PARTIAL | `CAM_aerial` rendered and viewed. `CAM_facade`, `CAM_floor`, `CAM_orbit` created but not rendered | `scripts/blender/lighting_cameras.py` |
| Render PNG | VERIFIED | `render.py` → `RENDER_OK … device METAL samples 32`; image opened and checked (two 2-storey blocks on site plane; dim, dark sky) | `assets/blender/renders/smoke/aerial.png` |
| GLB export + manifest (Y-up, names preserved) | VERIFIED | `export_glb.py` → `EXPORT_OK … objects 105` | `scripts/blender/export_glb.py` |
| verify_scene.py | VERIFIED | Original GLB: `VERIFY_OK 105/105`, 12 PASS, exit 0. Optimized GLB: same, exit 0 | `scripts/blender/verify_scene.py` |
| glTF optimization (gltf-transform 4.5.1 + meshopt) | VERIFIED | Before 4,570,476 B → after 4,473,952 B (−2.1%). Default flatten/join removed: they break names. Optimized GLB passes verify | `scripts/blender/node_tools/` |
| Poly Haven textures (CC0) | VERIFIED | `concrete_wall_008` (Diffuse, Rough, nor_gl, AO) and `wood_floor_deck` (same maps), 1K JPG, sha256 in provenance JSON. Licence checked at polyhaven.com/license | `assets/blender/materials/textures/*` |
| ifcopenshell (IFC4 write) | VERIFIED | `ifc_minimal_test.py` → `IFC_OK IFC4 walls 1 storeys 1` | `scripts/blender/ifc_minimal_test.py`, `scripts/blender/requirements.txt` |
| Bonsai on Blender 5.3 | BLOCKED (unsupported) | extensions.blender.org listing: compatibility Blender 4.2 LTS; "Unsupported: 5.1 and above" | `docs/ifc-bim.md` |
| Smoke test artifacts | VERIFIED | `public/models/test/smoke-complex.glb` (4,473,952 B), `smoke-complex.manifest.json`, render PNG; `setup-blender.sh` smoke run → `smoke test OK` | `public/models/test/*` |
| `scripts/setup-blender.sh` idempotent | VERIFIED | Full run → `smoke test OK`, exit 0; `--no-smoke` rerun → exit 0 | `scripts/setup-blender.sh` |
| Skill | VERIFIED (commands) | Every command in the skill was run; INPUT/PROCEDURE/VALIDATION/OUTPUT/FAILURE RECOVERY written | `.opencode/skills/procedural-blender-architecture/SKILL.md` |
| Docs | VERIFIED | Commands copied from runs above | `docs/blender-pipeline.md`, `docs/ifc-bim.md` |

## Fragments for the orchestrator

- `reports/fragments/A-blender-mcp.json`: adds an `mcp.blender` entry (uvx `mcp-for-blender`, `--port 9876`, `enabled: false`). It is disabled because port 9876 is currently held by an unrelated Blender GUI (PID 87529). The orchestrator must choose: stop that Blender, or change the port to 9877 in the fragment and the addon panel.
- `reports/fragments/A-verify-smoke.txt`: verifier output for `public/models/test/smoke-complex.*`.

## Remaining user actions (GUI)

1. Blender MCP server: open Blender with the GUI, enable "Interface: MCP for Blender" in Preferences > Add-ons (already installed), press N in the 3D Viewport, and click **Connect to Claude**. Stop or move the Blender instance currently on port 9876 first, or set the port to 9877 in the addon panel.
2. After step 1, rerun `BLENDER_PORT=<port> .venv-bim/bin/python scripts/blender/mcp_smoke_client.py` to confirm the connection. Then enable the `blender` entry in `opencode.jsonc` after the orchestrator merges the fragment.
3. Optional: run `~/.opencode/bin/opencode mcp list` once OpenCode's state database is repaired. That error is outside this agent's scope (the database is not in the repo).

## Notes

- `public/models/test/placeholder-building.glb` exists in the test directory and was not created by this agent. It was left untouched.
- Dimensions in all generated geometry are assumptions (`ASSUMPTION_TEST_GEOMETRY`, `source_ref=UNKNOWN`). Nothing here should be used as a calibrated source.
- `scripts/blender/out/` (about 9 MB) and `scripts/blender/node_tools/node_modules/` (65 MB) are regenerable and should be git-ignored by the orchestrator.
- No API keys were used or stored. No paid services were called. No sudo. Global `~/.config/opencode/opencode.json` was not modified.
