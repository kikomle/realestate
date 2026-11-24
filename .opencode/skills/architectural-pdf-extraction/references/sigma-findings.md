# Močire Zadar H — what the public Sigma sources contain (verified 2026-11-23)

Source: https://www.sigma.hr/projekti/mocire-zadar-h/ (robots.txt: `Disallow:` empty; all paths allowed).

| File | Type (checked with classify_pdf.py / PIL) | Contents | Usable for metric geometry? |
|---|---|---|---|
| floor-prizemlje.png (1920×688) | raster PNG | ground floor plan, apartment keys | No: no linear dimensions, no scale bar readable |
| floor-etaza-1.png (1920×585) | raster PNG | floor 1 plan | No |
| floor-etaza-2.png (1920×585) | raster PNG | floor 2 plan (viewed) | No |
| floor-etaza-3.png (1920×585) | raster PNG | floor 3 plan | No |
| floor-etaza-4.png (1920×586) | raster PNG | floor 4 plan | No |
| floor-galerije.png (1920×563) | raster PNG | gallery-level plan | No |
| apartment-H-0.1.pdf (1 page A4) | MIXED: 175 vector paths, 131 words, 13 raster image blocks covering the plan | apartment H 0.1 sheet: room list with net areas, NKP 56.41 m², NP 85.25 m², scale bar drawn but no numeric linear dimension | Partially: areas only; `calibration.uncalibrated = true` (no dimension strings matched to segments) |

Apartment table (from each floor page's embedded Angular data): 94 listed units (16/19/19/19/21 per floor for L00–L04). Listed "Obračunska površina" values are carried into `assets/geometry/apartments.json` as `gross_area_m2`. Net areas are null (listing gives none); orientation is null (none in source). The site's per-floor "available" badges (9, 5, 7, 4, 18) match the count of "Slobodno" rows in the data.

Missing for metric geometry (flagged):
- Linear dimensions on any plan (no dimension strings on the floor plans or the apartment sheet).
- Numeric scale bar value (the apartment sheet's bar has no numeric label).
- Vector floor plans (all floor plans are rasters).
- Wall thickness drawings, sections, elevations (heights/levels) — none published.
- Window/door sizes and sill heights.
- North arrow orientation — not shown on the sheets: UNKNOWN.
- Building count (sheet names "STAMBENA ZGRADA" and "Građevna cjelina H"; the number of buildings is not stated): UNKNOWN.
- Per-unit net areas and orientation.

Licence: publicly available on sigma.hr; local prototype use only; not for redistribution. Raw files are kept only in `assets/source/mocire-zadar-h/raw/` and are not copied to `public/`.
