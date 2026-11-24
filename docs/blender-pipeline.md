# Blender pipeline (Agent A)

Scope: `assets/blender/**`, `scripts/blender/**`, `scripts/setup-blender.sh`, `public/models/test/**`. The smoke-test record below concerns a synthetic test complex built on macOS arm64 with Blender 5.3.0.

## 1. Install

Prerequisites (already present on this machine): Blender 5.3.0 at `/Applications/Blender.app`, Python 3.12 at `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3`, Node 23, `uv` 0.13 via Homebrew.

```bash
scripts/setup-blender.sh            # full: build, export, optimize, render, verify
scripts/setup-blender.sh --no-smoke # environment only
```

What it does: checks Blender reports 5.x; creates `.venv-bim`; installs `scripts/blender/requirements.txt` (`ifcopenshell==0.9.0.post1`, `mcp==2.3.0`); installs the glTF tools into `scripts/blender/node_tools` (`@gltf-transform/cli` 4.5.1, `meshoptimizer` 1.3.0); runs the smoke test.

Not pinned by the script: `mcp-for-blender` (the Blender MCP server). It runs through `uvx --python 3.11 --from mcp-for-blender`, which resolves to the latest release.

## 2. Blender MCP (`mcp-for-blender`)

Repo: https://github.com/ahujasid/mcp-for-blender (formerly `blender-mcp`). PyPI: `mcp-for-blender` 2.3.1 (the `blender-mcp` name still works).

Install the addon (done on this machine; file `~/Library/Application Support/Blender/5.3/scripts/addons/blender_mcp.py`, identical to the bundled `addon.py`):
```bash
uvx --python 3.11 --from mcp-for-blender mcp-for-blender install-addon   # or the copy already in place
```

Start the server:
1. Open Blender with the GUI (`open -a Blender`).
2. Enable the addon: Edit > Preferences > Add-ons > "Interface: MCP for Blender".
3. In the 3D Viewport press N, open the **MCP for Blender** tab, and click **Connect to Claude** (the button that starts the socket server; the operator is `blendermcp.start_server`). Default port `9876`; set another port in the addon panel if needed.

Headless note: the addon refuses to start its server under `blender -b` ("commands would never execute"). A GUI session is required. Scripted GUI start was verified: `addon_utils.enable("blender_mcp")` plus `bpy.ops.blendermcp.start_server()` on a timer, port 9877.

MCP client test (verified):
```bash
BLENDER_PORT=9877 .venv-bim/bin/python scripts/blender/mcp_smoke_client.py
```
Output: tool list (10 tools including `get_scene_info`, `execute_blender_code`, `look`) and `get_scene_info` returning "Scene 'Scene' | 1 camera, 1 light, 1 mesh".

OpenCode wiring: fragment at `reports/fragments/A-blender-mcp.json` (`enabled: false` by default). Merge into `opencode.jsonc` only when a GUI Blender is running, then enable it. Port `9876` in the fragment is occupied on this machine by an unrelated Blender GUI (PID 87529, started from another project); either stop that instance or change the fragment's port to `9877` and start the addon on that port.

## 3. Generate, render, export, optimize, verify

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
OUT=scripts/blender/out
$B -b --factory-startup --python scripts/blender/build_test_complex.py -- --out $OUT/test_complex.blend
$B -b --factory-startup $OUT/test_complex.blend --python scripts/blender/export_glb.py -- --glb $OUT/test_complex.glb --manifest $OUT/test_complex.manifest.json
scripts/blender/node_tools/node_modules/.bin/gltf-transform optimize $OUT/test_complex.glb $OUT/test_complex.opt.glb \
  --compress meshopt --flatten false --join false --instance false --simplify false --texture-compress false
$B -b --factory-startup $OUT/test_complex.blend --python scripts/blender/render.py -- --camera CAM_aerial --out assets/blender/renders/smoke/aerial.png --samples 32 --res-x 960 --res-y 540
.venv-bim/bin/python scripts/blender/verify_scene.py --glb $OUT/test_complex.opt.glb --manifest $OUT/test_complex.manifest.json
```

Cameras: `CAM_aerial`, `CAM_facade`, `CAM_floor`, `CAM_orbit`.

Measured results:
- Scene build: 105 objects, about 2 s.
- GLB export: 4,570,476 bytes. Optimized (meshopt, quantized positions): 4,473,952 bytes (-2.1%). Flatten/join/instance are disabled on purpose; the defaults break node names.
- Render 960x540, 32 samples, Metal: 5 s on the second run (first run 6 min 10 s, which included Metal shader compile).
- Verify: 12/12 checks pass on both GLBs.

## 4. Materials and textures

Poly Haven (CC0; licence confirmed at https://polyhaven.com/license). Downloaded 1K sets with curl (Python urllib fails TLS verification on this machine):
- `concrete_wall_008`: Diffuse, Rough, nor_gl, AO.
- `wood_floor_deck`: Diffuse, Rough, nor_gl, AO.

Files and provenance JSON are in `assets/blender/materials/textures/`. Each provenance file records asset ID, API and page URLs, licence, retrieval date, and per-file SHA-256.

## 5. Known limitations (test geometry only)

- All dimensions are assumptions; every object carries `assumption=ASSUMPTION_TEST_GEOMETRY`.
- The aerial render is dim (single sun plus fill light; dark sky). It is a smoke test, not a marketing image.
- The stair is 16 box steps, no handrail. Windows are inset glass boxes, not window-frame geometry.
- Interior partitions split each floor into two apartments; no kitchens, bathrooms or furniture.
- `CAM_floor`, `CAM_facade` and `CAM_orbit` have not been rendered yet; only `CAM_aerial` was rendered and inspected.

## Scope for Močire Zadar H

The [build plan](BUILD-PLAN.md) permits Blender only for a documented exterior need: at most an exterior still from a verified, rights-cleared H input. No such input or cleared release still is recorded in the [source inventory](source-inventory.md). Floor and unit selection do not depend on Blender or the [metric pipeline](architectural-data-pipeline.md).

Keep the test complex and its smoke renders labelled `SYNTHETIC`; they do not depict H. A future verified exterior still would carry its own source, verification and permission record. Interiors, furniture and walkthroughs are outside the selector plan.
