# IFC / BIM evaluation (Agent A)

## ifcopenshell (Python) — VERIFIED

- Installed: `ifcopenshell==0.9.0.post1` in `.venv-bim` (pinned in `scripts/blender/requirements.txt`).
- Command: `.venv-bim/bin/python scripts/blender/ifc_minimal_test.py scripts/blender/out/minimal.ifc`
- Output: `IFC_OK IFC4 walls 1 storeys 1 scripts/blender/out/minimal.ifc`
- The test builds IfcProject > IfcSite > IfcBuilding > IfcBuildingStorey with an IfcWall (name follows the contract) and writes IFC4. It re-opens the file to confirm the wall and storey counts.

Use for: writing or reading IFC4 from the pipeline (source drawings and calibrated geometry export), and attaching `Pset`/custom properties. Not yet done: geometry representation in the test IFC (only semantic entities were written).

## Bonsai (IfcOpenShell's Blender add-on) — NOT USABLE on Blender 5.3

- Extensions listing (https://extensions.blender.org/add-ons/bonsai/, fetched 2026-11-23): latest version 0.9.0-post1, compatibility Blender 4.2 LTS; the page states "Unsupported: 5.1 and above". Platforms: macOS Apple Silicon, Windows, Linux.
- Conclusion: installing Bonsai into Blender 5.3 is unsupported. Do not install it into the 5.3 used by this pipeline.
- Options:
  1. Keep the Blender pipeline on 5.3 and use `ifcopenshell` directly (current approach).
  2. If authoring inside Blender with IFC semantics is needed, install Blender 4.2 LTS in a separate location and use Bonsai there. This is a second Blender install and needs its own user decision (paid bandwidth/disk, not a paid API).

## What is usable for the project

- Usable: ifcopenshell for IFC4 export/import and property sets; the contract naming and custom properties (`semantic_id`, `source_ref`, `confidence`) map directly to IFC `Name` and `Pset_*` properties.
- Usable: the GLB and manifest from the Blender pipeline for the web viewer. They do not depend on IFC.
- Not usable now: Bonsai on Blender 5.3; any IFC-derived geometry in Blender until a converter is validated.

## Not done (explicit)

- No real IFC source was provided by the project, so no IFC was imported and no source-derived geometry exists. All geometry is `ASSUMPTION_TEST_GEOMETRY`.
