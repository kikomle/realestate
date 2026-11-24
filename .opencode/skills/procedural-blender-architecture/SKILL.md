---
name: procedural-blender-architecture
description: Build, render, export and verify a procedural architectural test complex in Blender 5.3 with contract object names, optimized GLB export and a machine-readable manifest. Use when generating or validating Blender building geometry, renders or GLB exports.
---

# procedural-blender-architecture

Build, render, export and verify a procedural architectural test complex in Blender 5.3 with the contract names. Every command below was run and passed on this machine (macOS arm64, Blender 5.3.0, Cycles on Metal).

## INPUT
- Blender 5.3.0 at `/Applications/Blender.app/Contents/MacOS/Blender` (override with `BLENDER_BIN`).
- Project root `/Users/enzokutic/realestate2`, with `.venv-bim` (created by `scripts/setup-blender.sh`).
- Optional texture sets in `assets/blender/materials/textures/` (`concrete_wall_008_*_1k.jpg`, `wood_floor_deck_*_1k.jpg`, with provenance JSON). Without them, materials fall back to flat PBR colours.
- Dimensions are ASSUMPTIONS for pipeline testing: ceiling 2.8 m, slab 0.25 m, wall 0.2 m, building 12 x 8 m, 6 m gap. They are tagged `assumption=ASSUMPTION_TEST_GEOMETRY`, `source_ref=UNKNOWN`, `confidence<=0.3`. Real dimensions must come from a calibrated source (GATE 2), never from this skill.

## PROCEDURE
1. Build the scene (headless, ~2 s):
   `Blender -b --factory-startup --python scripts/blender/build_test_complex.py -- --out scripts/blender/out/test_complex.blend`
   Produces 2 buildings (B01, B02) x 2 levels (L00, L01), apartments U101/U102 and U201/U202 (named `U{level}{01|02}`), walls with boolean-cut door and window openings, slabs, balconies, a 16-step stair, a roof, a column, a site plane `B00__L00__NONE__site__001`, and 105 objects. It also writes `build_manifest.json`.
2. Export GLB + manifest (~1 s): `Blender -b --factory-startup <blend> --python scripts/blender/export_glb.py -- --glb <out.glb> --manifest <out.json>`. Applies rotation/scale to mesh objects, exports glTF Y-up with node names preserved, and writes `contract` extras.
3. Optimize (optional, ~0.1 s): `scripts/blender/node_tools/node_modules/.bin/gltf-transform optimize in.glb out.glb --compress meshopt --flatten false --join false --instance false --simplify false --texture-compress false`. Do not use the defaults: they flatten and join, which destroys node names and hierarchy.
4. Render (Cycles, Metal; 32 samples at 960x540 took ~6 min on the first run, ~5 s on the second): `Blender -b --factory-startup <blend> --python scripts/blender/render.py -- --camera CAM_aerial --out <png> --samples 32 --res-x 960 --res-y 540`. Cameras: `CAM_aerial`, `CAM_facade`, `CAM_floor`, `CAM_orbit`.
5. Verify without a GUI: `python3 scripts/blender/verify_scene.py --glb <glb> --manifest <json>`.

## VALIDATION
`verify_scene.py` must print `VERIFY_OK` and exit 0. It checks, in order:
- GLB container is glTF 2.0 with a valid JSON chunk.
- No duplicate node names; every manifest name exists as a node and vice versa (105/105).
- Every name matches `{B}__{L}__{U}__{TYPE}__{IDX}`.
- Every manifest parent is the GLB parent node.
- Bounding boxes are finite, in metres, non-zero.
- Every mesh has triangles > 0.
- POSITION accessors have sane min/max. Quantized (normalized) accessors are checked for finiteness only; their real span is encoded in the node transform.
- `semantic_id == name`, `source_ref` is a string, `confidence` is in [0,1].
- Expected buildings, levels, and apartment units are present.

Last verified results: original GLB and optimized GLB both pass 12/12 checks. Optimized GLB size 4,473,952 bytes vs 4,570,476 bytes original (-2.1%). The optimized GLB is the deliverable at `public/models/test/smoke-complex.glb`.

Do not trust a render you have not looked at. The aerial smoke render was viewed and shows two two-storey blocks on a site plane.

## OUTPUT
- `scripts/blender/out/test_complex.{blend,glb,opt.glb,manifest.json}` (intermediates; regenerate them rather than committing).
- `public/models/test/smoke-complex.glb` and `public/models/test/smoke-complex.manifest.json` (the optimized GLB and its manifest).
- `assets/blender/renders/smoke/aerial.png`.
- `reports/fragments/A-verify-smoke.txt` (verifier output).
- Manifest fields per object: `id`, `name`, `parent`, `building`, `level`, `unit`, `type`, `bbox_m {min,max,size}`, `triangles`, `materials`, `source_ref`, `confidence`.

## FAILURE RECOVERY
- `ValueError: object name violates contract` from `build_test_complex.py`: a name does not match the regex in `common.py`. Fix the name; do not relax the regex. (This already happened once: the site was named `SITE__...` and was changed to `B00__...`.)
- `verify_scene.py` FAIL on POSITION range after gltf-transform: check whether the accessor is `normalized` (KHR_mesh_quantization). That is expected, and the verifier handles it. Any other FAIL is a real problem.
- `verify_scene.py` FAIL on hierarchy or missing nodes: the export ran with `--flatten true` or join. Re-run the optimize step with the flags above.
- Render error `camera not found`: check the camera name in `lighting_cameras.py`.
- Render slow or GPU error: pass `--cpu` to `render.py`. Metal was used successfully here.
- Blender reports `BlenderMCP: cannot start server in background mode`: the MCP addon only runs in GUI Blender. Use a GUI instance (see docs/blender-pipeline.md), not `-b`.
- Blender `Traceback` with `arg_flag` missing or similar: `common.py` must export `arg_value`, `arg_flag`, `Namer`, `assert_contract_name`, `boolean_cut`, `make_box`, `set_props`.
