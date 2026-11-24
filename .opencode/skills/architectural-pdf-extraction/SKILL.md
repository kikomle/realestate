---
name: architectural-pdf-extraction
description: Turn an architectural PDF plan into calibrated, metric 2D geometry JSON (walls, rooms, units) using PyMuPDF vector extraction, scale/dimension calibration, and Shapely reconstruction. Use when given a floor plan or apartment sheet PDF and asked for geometry, areas, or dimensions.
---

# Architectural PDF extraction

## INPUT
- A PDF (or PNG/JPG) source file under `assets/source/<project>/raw/` with its sidecar `*.provenance.json`.
- A config JSON: `project`, `building` (B01…), `level` (L00, L01…, LM01…), `unit` (U101 style or NONE), `unit_label`, `room_name` (only if the sheet names the room), `north_arrow_deg` (null unless the drawing shows one), `source.page`.
- Python env: `/Users/enzokutic/realestate2/.venv` (PyMuPDF 1.27.2.3, Shapely 2.1.2, NumPy 2.2.6, pytest 8.4.2). Poppler is at `/opt/homebrew/bin` for `pdfinfo`/`pdftoppm` cross-checks.

## PROCEDURE
1. Classify: `.venv/bin/python scripts/pdf/classify_pdf.py <pdf> <out.json>`. Each page is VECTOR, MIXED, RASTER, TEXT_ONLY or EMPTY.
   - RASTER pages cannot yield geometry. Stop and report BLOCKED with the page class.
   - MIXED pages can only yield geometry from their vector paths. Walls must come from dark filled rectangles; a raster tile contributes nothing.
2. Extract: `scripts/pdf/extract_vectors.py <pdf> <out_dir>` writes `raw/page-NNN.json` (paths, text lines with bboxes, image blocks) in PDF points, y down.
3. Calibrate: `scripts/pdf/calibrate.py <page.json> <cal.json>`.
   - Scale text `1:N` gives metres_per_pt = N × 0.0254 / 72.
   - Each standalone `<value> m|cm|mm` label is matched to the nearest line segment within 60 pt.
   - Residual > 2% is flagged. No dimension pairs means `uncalibrated: true`, and the procedure stops with no metric output.
4. Reconstruct: `scripts/pdf/reconstruct_walls.py <page.json> <cal.json> <config.json> <geometry.json>`. It unions dark wall rectangles, takes the envelope, and polygonises interior holes ≥ 1.0 m² as rooms.
5. One-shot alternative: `scripts/pdf/run_pipeline.py <pdf> <config.json> <out_dir>` runs steps 1–4 and validation, and exits 3 when uncalibrated.
6. Validate: `scripts/validate/validate_geometry.py <geometry.json> [--apartments assets/geometry/apartments.json]`.

## VALIDATION
- `.venv/bin/python -m pytest tests/geometry -q` must pass (22 tests, including refusal paths for uncalibrated input, bad unit names, open polygons and non-metre units).
- The synthetic fixture recovers 6.00 m × 4.00 m and 0.20 m walls at 1:100 within 1%/2 cm (`tests/fixtures/make_synthetic.py`). Results from it are labelled SYNTHETIC.
- Any real-source run must report calibration method, residual, dimension pairs and flags. Do not report metric values without `uncalibrated: false`.

## OUTPUT
- `geometry.json` conforming to `assets/geometry/schema/geometry.schema.json`, with `units: "m"`, `calibration`, `source.sha256`, and `missing` listing every gap (height, openings, north arrow, room names).
- `calibration.json` with dimension pairs and residuals.
- `classify.json` with per-page class and counts.
- A `report.md` next to the geometry with confidence and uncertainty, labelled SYNTHETIC where applicable.

## FAILURE RECOVERY
| Symptom | Cause | Action |
|---|---|---|
| Page class RASTER | Plan is a bitmap | Report BLOCKED. Ask for the vector PDF or CAD export. Do not trace the image. |
| `NO_DIMENSIONS` / `uncalibrated: true` | No dimension strings matched to lines | Stop. Do not invent a scale. Request a dimensioned vector sheet. |
| `NO_TEXT` on a VECTOR/MIXED page | Outlined text | Calibrate from scale text only if it is text; otherwise uncalibrated. |
| `RESIDUAL_OVER_2PCT` / `SCALE_MISMATCH` | Scale text disagrees with dimensions, or dimensions disagree | Do not pick one silently. Report both values; keep `uncalibrated: false` only if the dimension median is the sole basis and the flag is recorded. |
| `no wall solids found` | Walls drawn as strokes, not fills | Extend `reconstruct_walls.py` to pair parallel lines; do not fake walls. |
| Validator fails naming | Unit id included TYPE suffix | Unit ids are `B01__L00__U001`; TYPE applies only to walls/openings. |

Tested files: `scripts/pdf/{classify_pdf,extract_vectors,calibrate,reconstruct_walls,run_pipeline,pdfgeo,fetch_sigma,build_apartments}.py`, `scripts/validate/validate_geometry.py`, `tests/geometry/test_pipeline.py`, `tests/fixtures/make_synthetic.py`.
See `references/sigma-findings.md` for what the Močire Zadar H sources contain and why they are blocked.
