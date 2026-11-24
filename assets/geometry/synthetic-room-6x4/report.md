# Validation report — SYNTHETIC-ROOM-6x4

**Label: SYNTHETIC.** The source is a generated PDF (`tests/fixtures/make_synthetic.py`), not a real building. These results test the pipeline only.

## Input
- Source: `tests/fixtures/synthetic_room_6x4.pdf`, page 1, 1:100 scale, dimension labels "6.00 m" and "4.00 m".
- Ground truth (`tests/fixtures/synthetic_room_6x4.truth.json`): clear room 6.00 m × 4.00 m, walls 0.20 m, area 24.00 m².

## Results (from `geometry.json`, `calibration.json`, `classify.json`)

| Quantity | Truth | Recovered | Error | Tolerance | Pass |
|---|---|---|---|---|---|
| Dimension "6.00 m" → segment | 6.00 m | 6.00 m | 0.00% | 1% | yes |
| Dimension "4.00 m" → segment | 4.00 m | 4.00 m | 0.00% | 1% | yes |
| metres per PDF point | 0.0352777778 (1:100) | 0.0352777835 | 0.0000016% | 2% residual | yes |
| Calibration residual | — | 0.0000% | — | 2% | yes |
| Room area | 24.00 m² | 24.00 m² | 0.00% | 2% | yes |
| Wall thickness (4 walls) | 0.20 m | 0.200 m each | 0.00 cm | 1 cm | yes |

Classification: VECTOR (2 path groups, 7 items, 17 words, 0 image blocks).

## Confidence and uncertainty
- Room and unit confidence: 0.9 (calibration method `dimensions+scale_text`).
- Wall confidence: 0.9 (same method). The `height_m` for all walls is null with flag `HEIGHT_UNKNOWN`.
- Uncertainty: for this exact synthetic drawing, residual is 0. In a real drawing, expect raster-free but imprecise line endpoints and label placement; the 2% residual gate would flag those.
- Not tested here: openings, north arrow (UNKNOWN), multiple rooms, curved walls, scanned plans.

## Gates
- `validate_geometry.py … --apartments assets/geometry/apartments.json` → PASS.
- `reality_check.py … --source-dims '{"width_m":6.0,"height_m":4.0}'` → UNVERIFIED (exit 1). Dimensions pass; floor_count, openings, unit_positions and source_fidelity are skipped because no Blender manifest or source mask exists. A 6.5 m source dimension gives REJECTED (exit 2).

## Verdict
Pipeline correct on synthetic input. Nothing here proves architectural accuracy of Močire Zadar H, which has no calibrated source (see `reports/setup-D-source.md`).
