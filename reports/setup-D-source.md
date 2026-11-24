# Setup D — source, PDF pipeline and validation

Date: 2026-11-23 (UTC). Machine: macOS arm64. Project: /Users/enzokutic/realestate2 (not a git repo).

## Component results

| Component | Status | Evidence | Files |
|---|---|---|---|
| Source inventory (sigma.hr) | VERIFIED | 5 floor pages fetched; 94 listed units; 7 files downloaded with sha256; per-floor "Slobodno" counts equal the site's badges (9/5/7/4/18) | `assets/source/mocire-zadar-h/inventory.json`, `assets/source/mocire-zadar-h/raw/*` (+ `.provenance.json`), `scripts/pdf/fetch_sigma.py`, `docs/source-inventory.md` |
| Environment (.venv, pins, poppler) | VERIFIED | `pip check` clean; 9 packages pinned; `import` of fitz 1.27.2.3, cv2 4.12.0, shapely 2.1.2, numpy 2.2.6, PIL 12.0.0, jsonschema 4.25.1, pytest 8.4.2; `pdfinfo` 26.11.0 | `requirements.txt`, `.venv/` |
| PDF classification | VERIFIED | Synthetic → VECTOR; Sigma apartment sheet → MIXED (175 vector paths, 131 words, 13 image blocks); Sigma floor PNGs → raster | `scripts/pdf/classify_pdf.py` |
| Vector extraction | VERIFIED | Page JSON with paths, texts, image blocks for synthetic and Sigma sheet | `scripts/pdf/extract_vectors.py` |
| Calibration | VERIFIED (synthetic) / BLOCKED (real) | Synthetic: 6.00 m and 4.00 m recovered, residual 0.0000%, method dimensions+scale_text. Sigma sheet: uncalibrated (no dimension strings matched) | `scripts/pdf/calibrate.py`, `assets/geometry/synthetic-room-6x4/calibration.json` |
| Wall / room reconstruction | VERIFIED (synthetic) | 24.00 m² room, 4 walls at 0.200 m, 5-vertex ring; refuses uncalibrated input (test) | `scripts/pdf/reconstruct_walls.py`, `scripts/pdf/run_pipeline.py` |
| Geometry schema | VERIFIED | JSON Schema 2020-12; validates synthetic output | `assets/geometry/schema/geometry.schema.json` |
| Apartment schema + inventory | PARTIAL | 94 units with gross area and source_ref; net area and orientation null with flags | `assets/geometry/schema/apartments.schema.json`, `assets/geometry/apartments.json`, `scripts/pdf/build_apartments.py` |
| Validator | VERIFIED | Synthetic PASS; 4 negative tests (uncalibrated, bad unit id, open polygon, wrong units) return non-zero | `scripts/validate/validate_geometry.py` |
| Reality validation | VERIFIED (logic) / UNVERIFIED (real) | 7 verdict tests pass; dimension mismatch → REJECTED exit 2; skipped checks → UNVERIFIED; real building has no manifest and no calibrated source | `scripts/validate/reality_check.py`, `tests/geometry/test_reality.py` |
| Tests | VERIFIED | `pytest tests/geometry -q` → 22 passed (15 pipeline/validator, 7 reality verdict) | `tests/geometry/test_pipeline.py`, `tests/geometry/test_reality.py`, `tests/fixtures/make_synthetic.py` |
| Docs | VERIFIED | written and cross-checked against the files | `docs/geometry-schema.md`, `docs/architectural-data-pipeline.md`, `docs/source-inventory.md` |
| Skills | VERIFIED | Both SKILL.md files reference scripts and tests that exist and were run | `.opencode/skills/architectural-pdf-extraction/`, `.opencode/skills/architectural-reality-validation/` |

## Sigma-published drawings found
1. Floor plans, PNG raster, one per floor: Prizemlje, Etaža 1–4, plus a gallery-level plan (6 files). **None usable for metric geometry**: rasters with no dimension strings or readable scale bar.
2. Apartment sheet H 0.1, PDF (MIXED). Usable for **areas only** (room net areas, NKP 56.41 m²). **Uncalibrated.**
3. Apartment detail pages for the other 93 units were listed but their sheets were not downloaded (only H 0.1 was fetched, as a representative sheet).
4. Construction photos, renders, and the site video: found, not downloaded (no geometry).

## Smoke test calibration (SYNTHETIC)
- Fixture: 6.00 m × 4.00 m clear room, 0.20 m walls, 1:100, dimension labels "6.00 m" and "4.00 m".
- Recovered: 6.00 m and 4.00 m (exact), metres_per_pt 0.0352777835 (scale 1:100 → 0.0352777778; difference 0.0000016%), residual 0.0000%, room area 24.00 m² (truth 24.00 m²), wall thickness 0.200 m.
- Label: **SYNTHETIC**. These results show the pipeline works on exact geometry; they say nothing about the real building.

## Flagged missing dimensions — Močire Zadar H
Nothing below is estimated. Every item is UNKNOWN or MISSING_SOURCE:
- All linear dimensions for every floor plan and unit (no dimension strings; floor plans are rasters).
- Scale bar: drawn on the apartment sheet, no numeric label → no metric scale from the source.
- Wall thicknesses for drawn walls (only quoted build-up values exist in the technical description: facade ETICS 10 cm mineral wool; interior partitions 10–12.5 cm; roof slab 20–25 cm; none is a drawn dimension).
- Storey heights, floor-to-floor, and elevation of each level (no section or elevation published) → `height_m` and `elevation_m` null, HEIGHT_UNKNOWN.
- Window and door sizes, sill heights, and opening counts (not extracted; plan symbols are raster) → OPENINGS_UNKNOWN.
- North arrow orientation → UNKNOWN.
- Number of buildings and building footprint (the sheet title is "STAMBENA ZGRADA"; no building count is stated) → UNKNOWN.
- Net areas per unit (listing gives only the sales/gross area; the H 0.1 sheet gives a room list for that unit only) → AREA_NET_UNVERIFIED for all 94 units.
- Apartment orientation (not in source) → ORIENTATION_UNKNOWN for all 94 units.
- Other 93 unit detail sheets: not downloaded; their room lists are not verified.

## Gate status
- GATE 2 (Architectural Source Ready): **NOT MET** for Močire Zadar H. No calibrated metric source exists. The pipeline itself is verified on synthetic data.
- Agent A may build only from SYNTHETIC/test geometry, and must label it as such. The real-building model stays blocked until a dimensioned vector source is provided (e.g., the architect's CAD/PDF export).

## Blockers and next action
- BLOCKED: a dimensioned vector drawing of Močire Zadar H. Request it from Sigma (prodaja@sigma-zadar.hr is the public contact on the site) or from the architect SB-Projektiranje d.o.o. (named on the sheet).
- Not run: Blender manifest reality check (no manifest from Agent A yet).

## Commands run
- `scripts/pdf/fetch_sigma.py` → floors=5 units_listed=94 downloads=7
- `scripts/pdf/run_pipeline.py tests/fixtures/synthetic_room_6x4.pdf … assets/geometry/synthetic-room-6x4` → PASS (exit 0)
- `scripts/validate/validate_geometry.py … --apartments assets/geometry/apartments.json` → PASS
- `pytest tests/geometry -q` → 22 passed
- `scripts/validate/reality_check.py …` → UNVERIFIED (exit 1) with dims only; REJECTED (exit 2) on 6.5 m vs 6.0 m
