# Source inventory — Močire Zadar H (sigma.hr)

**Historical seven-file discovery inventory.** For the subsequent 202-file Stage 2 collection and verified floor mappings, see [ASSET-SOURCES.md](ASSET-SOURCES.md).

Retrieved: 2026-11-23 (UTC). Inventory data: `assets/source/mocire-zadar-h/inventory.json`. Raw files: `assets/source/mocire-zadar-h/raw/` (each with a `.provenance.json` sidecar: URL, retrieved_at, sha256, licence note).

Licence/terms: publicly available on sigma.hr; local prototype use only; not for redistribution. robots.txt (`User-agent: *` / `Disallow:` empty) allows all paths. Requests were made one at a time with a 1 s delay.

## Public project page sections
- Prikaz stanova (floor pages): Prizemlje (9 available badge), Etaža 1 (5), Etaža 2 (7), Etaža 3 (4), Etaža 4 (18).
- Video of construction site and a gallery of construction photos and renders — not downloaded (not geometry sources).
- Tehnički opis (technical description, text in the page): structure (AB walls and slabs), floors, roof, windows (PVC, IZO glass), facade (ETICS, 10 cm mineral wool), interior partitions (GK, 10–12.5 cm mineral wool fill). This is text; it gives wall-build-up thicknesses where quoted (facade 10 cm, partition 10–12.5 cm, roof slab 20–25 cm). These are recorded as sourced text values, not as drawn geometry.
- Prodaja (sales): sales e-mail/phone only; no prices downloaded.

## Files

| # | File | URL | Type | Pages/size | Content | Dimensions present? | sha256 (first 12) |
|---|---|---|---|---|---|---|---|
| 1 | floor-prizemlje.png | https://www.sigma.hr/wp-content/uploads/2025/10/Mocire-Zadar-H-Tlocrt-prizemlja.png | raster image | 1920×688 | Ground floor plan with apartment keys | No | 5eb6c9cee788 |
| 2 | floor-etaza-1.png | …/Mocire-Zadar-H-Tlocrt-prvog-kata.png | raster image | 1920×585 | Floor 1 plan | No | 8fe68f94254c |
| 3 | floor-etaza-2.png | …/Mocire-Zadar-H-Tlocrt-drugog-kata.png | raster image | 1920×585 | Floor 2 plan | No | 247a2e5db128 |
| 4 | floor-etaza-3.png | …/Mocire-Zadar-H-Tlocrt-treceg-kata.png | raster image | 1920×585 | Floor 3 plan | No | 436cbb0c38e1 |
| 5 | floor-etaza-4.png | …/Mocire-Zadar-H-Tlocrt-cetvrtog-kata.png | raster image | 1920×586 | Floor 4 plan | No | 2515268e087a |
| 6 | floor-galerije.png | …/Mocire-Zadar-H-Tlocrt-galerije.png | raster image | 1920×563 | Gallery-level plan | No | 053c3e7bf7fa |
| 7 | apartment-H-0.1.pdf | …/Mocire-Zadar-H-0.1.pdf | MIXED vector PDF | 1 page A4, 506,836 B | Apartment H 0.1: room list, NKP 56.41 m², NP 85.25 m²; plan embedded as raster tiles | Scale bar only, no numeric dimension | 42842166493f |

The H exterior gallery (`Mocire_H-Zadar_000–007`) is a remote candidate for the overview still. It was not downloaded and has no recorded release clearance. The `mocire-j-zadar-*` images depict a different building; neither they nor the construction photos or video are candidates. H 0.1 is the only apartment-detail sheet downloaded.

## Interactive image maps on the floor pages (verified, read-only)

The five Sigma floor pages carry `<img usemap>` plus a matching `<map>` of
`<area shape="polygon" href=<detail_url> coords="…">`. A live read-only HTML parse found **16 / 19 /
19 / 19 / 21** main unit polygons for Prizemlje / Etaža 1–4, and the hrefs join **all 94** unit URLs.

- The L04 page additionally maps `floor-galerije.png` to the **same 21** L04 detail URLs, so a unit ID
  can appear as a polygon on more than one image (polygon identity is per-image + ID).
- On the L04 main plan, `H 4.5` has `maxY=587` on a 1920×586 image — flagged for owner review /
  list-only; do not auto-clip or ship guessed coordinates.
- These are **third-party** polygon coordinates. They are not copied, published, or used; the repo
  source inventory contains **no polygons**. Request owner-approved art and its matching map, or permission to make a new registration.

## Classification
- Vector PDFs: 1 of 7 files (apartment-H-0.1.pdf), and it is MIXED (raster plan tiles).
- Raster images: 6 of 7 files.
- Usable for metric geometry: none. See `.opencode/skills/architectural-pdf-extraction/references/sigma-findings.md`.

## Apartment inventory
`assets/geometry/apartments.json` contains 94 units from the floor pages' embedded data. `gross_area_m2` is the storage name for **Obračunska površina**, the published listing area; neither gross nor net floor area is verified. Net area and orientation are null with flags.

## Display limits
- `property_type`: all 94 unit records are `"Stan"`; no other property type is present.
- The gallery plan adds no floor, unit records or route.
- Address: no address field exists in `inventory.json` or `apartments.json`; do not display one.
- Prices: none sourced (the Prodaja section carries contact details only); nothing to show.
- No H release art is cleared. Permission to display an image and permission to use its registration are separate. Raw drawings stay in `assets/source/` and never enter `public/`. See the [build plan](BUILD-PLAN.md) for the release contract.
