# Architectural data pipeline (Agent D)

## Image-space registration for the planned selector

The [selector](BUILD-PLAN.md) needs pixel registrations on the actual H images. There is no registered H overlay geometry in the repo: the recorded PNG sizes are source metadata, and the synthetic metric fixture is test data. Neither supplies hotspot vertices or confidence values for H.

- **OVERVIEW:** key each exterior floor band by `(image, level)`. **FLOOR:** key each plan polygon by `(image, level, unit_id)`. Bind each registration to the image hash, intrinsic pixel size, SVG `viewBox` and crop. The gallery plan links the same 21 L04 units as the main plan but requires a separate registration.
- Obtain the owner's approved matching art and map, or permission for a new registration. Check art display rights and registration rights separately for the intended use. Do not copy Sigma's third-party polygons. The [source inventory](source-inventory.md) records the read-only map inspection.
- Compare expected and registered keys per image. Every missing, invalid or duplicate key needs resolution; an approved list-only exception must name its key, reason, reviewer and reachable link. The main L04 map for `H 4.5` reaches y=587 on a 1920×586 image. Seek owner review or use the reviewed list-only exception; never guess or auto-clip a shape.

## Legacy metric steps (archived)

These tools produced calibrated metric geometry for a synthetic fixture only. The former model track required a calibrated source and a model/manifest reality check. Neither is a prerequisite for the [image-first gates](workflow-gates.md).

## 1. Environment
- `.venv` (Python 3.12.8), pins in `requirements.txt`. Poppler 26.11.0 via Homebrew (`pdfinfo`, `pdftoppm`).
- Check: `.venv/bin/python -m pip check` and `.venv/bin/python -m pytest tests/geometry -q`.

## 2. Fetch (provenance)
`scripts/pdf/fetch_sigma.py` — reads the 5 floor pages, parses the embedded apartment array, downloads the floor-plan PNGs and one apartment PDF, writes per-file `.provenance.json` and `assets/source/mocire-zadar-h/inventory.json`. One request per second.

## 3. Classify
`scripts/pdf/classify_pdf.py <pdf> <out.json>` → VECTOR | MIXED | RASTER | TEXT_ONLY | EMPTY per page. RASTER pages cannot produce geometry.

## 4. Extract
`scripts/pdf/extract_vectors.py <pdf> <out_dir>` → `page-NNN.json` (drawing paths, text lines with bboxes, image blocks), PDF points, y down.

## 5. Calibrate
`scripts/pdf/calibrate.py <page.json> <cal.json>` — scale text (`1:N`) and linear dimension strings (`m|cm|mm`) matched to segments. Residual > 2% flagged. No dimension pairs → `uncalibrated: true`.

## 6. Reconstruct
`scripts/pdf/reconstruct_walls.py <page.json> <cal.json> <config.json> <geometry.json>` — dark filled rectangles → wall solids (Shapely union), envelope via convex hull, interior holes ≥ 1 m² → rooms. Refuses uncalibrated input.

## 7. Validate
`scripts/validate/validate_geometry.py <geometry.json> [--apartments …]` — schema, naming, closure, area, `units == "m"`, `uncalibrated == false`. Exit non-zero on failure.

## 8. Reality check
`scripts/validate/reality_check.py <geometry.json> [--manifest …] [--source-dims …] [--source-mask …] [--report …]` → VERIFIED | UNVERIFIED | REJECTED. Needs a calibrated source and Agent A's manifest (`public/models/*.manifest.json`, may be absent). Without them the verdict is UNVERIFIED and "architecturally accurate" is never printed.

## One-shot runner
`scripts/pdf/run_pipeline.py <pdf> <config.json> <out_dir>` runs 3–7 (exit 3 if uncalibrated; the validator's exit code otherwise).

## Apartment inventory
`scripts/pdf/build_apartments.py <inventory.json> <out.json>` → `assets/geometry/apartments.json` (sourced fields only).

## Recorded metric results
- Synthetic fixture (SYNTHETIC): recovered 6.00 m × 4.00 m, 24.00 m², walls 0.200 m, residual 0.0000%; validator PASS; 22/22 tests pass.
- Močire Zadar H: 94 apartments inventoried (published listing area "Obračunska površina"; not verified gross or net); no calibrated metric geometry.
