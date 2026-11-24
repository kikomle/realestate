---
name: architectural-reality-validation
description: Check whether a geometry JSON and its Blender model match the calibrated source plan and manifest, and return a VERIFIED, UNVERIFIED or REJECTED verdict with reasons. Use before anyone claims a 3D model is architecturally accurate.
---

# Architectural reality validation

## INPUT
- `geometry.json` from the architectural-pdf-extraction pipeline (schema `assets/geometry/schema/geometry.schema.json`).
- Optional Blender manifest `public/models/<name>.manifest.json` produced by Agent A, with keys `levels: [{id}]`, `openings: []`, `units: [{id, position_m: [x, y]}]`.
- Optional source dimensions as inline JSON or file, e.g. `{"width_m": 6.0, "height_m": 4.0}` from a source dimension string.
- Optional source mask polygon for IoU, `{"polygon_m": [[x,y],...]}`.

## PROCEDURE
1. Run `.venv/bin/python scripts/validate/reality_check.py <geometry.json> [--manifest m.json] [--source-dims '{...}'] [--source-mask mask.json] [--report out.md]`.
2. The script runs the schema validator first. Any schema error gives REJECTED.
3. It then runs five checks: dimensions, floor_count, openings, unit_positions (tolerance 0.10 m), source_fidelity (IoU ≥ 0.90).
4. Skipped checks are recorded as skip, not pass. The verdict counts only executed checks.

## VALIDATION
- `.venv/bin/python -m pytest tests/geometry/test_reality.py -q` covers: dimension mismatch → REJECTED; matching dimensions alone → UNVERIFIED with no "architecturally accurate" statement; uncalibrated → never VERIFIED; floor-count mismatch → REJECTED; unit offset of 0.5 m → REJECTED; missing source → UNVERIFIED; schema break → REJECTED.
- Exit codes: 0 VERIFIED, 1 UNVERIFIED, 2 REJECTED.

## OUTPUT
- JSON on stdout: `verdict`, `reasons`, `checks[]`, and `statement` only when VERIFIED.
- Markdown report if `--report` is given.
- The phrase "architecturally accurate" may appear only with VERIFIED, and then only for the checked properties.

## FAILURE RECOVERY
| Verdict / reason | Meaning | Action |
|---|---|---|
| UNVERIFIED: "calibration.uncalibrated=true" | No metric source | Obtain a dimensioned vector source. Do not lower the bar. |
| UNVERIFIED: "checks skipped" | Manifest or mask not supplied | Provide the manifest from Agent A and the source dims/mask, then rerun. |
| REJECTED: dimensions | Geometry differs from source by > 2 cm | Fix reconstruction (calibration/wall pairing), not the threshold. |
| REJECTED: floor_count | Model levels ≠ source levels | Fix the Blender generator or the level list. |
| REJECTED: unit_positions | Unit anchor > 0.10 m from geometry centroid | Check the manifest's coordinate origin (must be SW ground corner, Z-up). |
| REJECTED: validator | Schema/naming/unit error | Run `scripts/validate/validate_geometry.py` for the details. |

Tested files: `scripts/validate/reality_check.py`, `scripts/validate/validate_geometry.py`, `tests/geometry/test_reality.py`.
Current status for Močire Zadar H: no calibrated metric source and no Blender manifest exist, so the verdict is UNVERIFIED (see `references/sigma-findings.md`).
