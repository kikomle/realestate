# Močire Zadar H · Stage 2 source register

**Local demo snapshot, 23 November 2026 (UTC).** [Sigma's H project](https://www.sigma.hr/projekti/mocire-zadar-h/) links five floor pages. They list 94 apartments and provide six whole-floor images. Each of the 94 detail pages linked one PDF download and one individual plan PNG. The L04 gallery is an upper drawing of the same 21 duplexes.

The [per-file ledger](../assets/source/mocire-zadar-h/stage2-manifest.json) is the inventory for this snapshot. Each of its 202 `assets` records gives the original and resolved URL, original filename **including revision suffixes**, referring page, retrieval time, HTTP `Last-Modified`, byte count, SHA-256, private path, rights record and applicable unit ID. Raster entries include format, intrinsic dimensions and the separate optimized file's metadata. PDF entries include page count and embedded creation/modification dates. `pages` records the 100 referring pages, their hashes, retrieval times and available publisher dates; `floor_snapshots` preserves the source rows. Paths inside asset records are relative to `assets/source/mocire-zadar-h/`.

| Material | Originals | Where to find the private files |
|---|---:|---|
| H exterior renders | 8 JPEGs | `raw/stage2/exterior/Mocire_H-Zadar_000.jpg` through `_007.jpg` |
| Whole-floor drawings | 6 PNGs | `raw/floor-*.png` (hash-identical earlier downloads reused) |
| Individual apartment drawings | 94 PNGs | `raw/stage2/unit-plan/` |
| Individual apartment sheets | 94 one-page PDFs | `raw/stage2/sheet/`, plus the preserved `raw/apartment-H-0.1.pdf` |
| Web copies | 108 WebPs | `raw/stage2/webp/`; per-asset `optimized.path` |

**Dates and versions.** The H page declares publication on 2025-07-02 and modification on 2026-11-23. An upload directory is not a drawing date. For example, the [H 0.1 PDF](https://www.sigma.hr/wp-content/uploads/2025/10/Mocire-Zadar-H-0.1.pdf) is in `/2025/10/` but its embedded modification date is 2026-02-09 and its HTTP `Last-Modified` is 2026-03-18. A design approval/issue date is not established by either. Use the ledger rather than synthesizing filenames: [H 0.3's PDF](https://www.sigma.hr/wp-content/uploads/2025/10/Mocire-Zadar-H-0.3-1.pdf) has a `-1` suffix while its drawing PNG does not. The gallery's actual referrer is [Etaža 4](https://www.sigma.hr/projekti/mocire-zadar-h/etaza-4/), correcting the discovery reference in the earlier seven-file inventory.

**Copyright and download conditions.** The project footer reads “SIGMA © 2023 - 2026. Sva prava pridržana.” The sheets identify SIGMA MOCIRE d.o.o. and design practice SB-PROJEKTIRANJE d.o.o.; a separate render-author licence is not identified. The public detail pages provide explicit PDF download buttons. At collection, [`robots.txt`](https://www.sigma.hr/robots.txt) contained `User-agent: *` and an empty `Disallow:`. The footer links privacy and cookie policies; no reuse licence was identified. The collector used linked anonymous GETs, one at a time, spaced at least one second apart. No login, paid service, image-map coordinates, or unlinked URL guessing.

| Use | Local Stage 2 decision | Public release |
|---|---|---|
| Art and derivative display | User-requested private demo/review. Publisher download links and the project footer are recorded; no separate owner display grant on file. | Not cleared |
| Registration data | New private traces from the native drawings and matching unit sheets. No imported Sigma HTML hotspots. | No recorded permission for release |

**Optimization.** The six floor plans and 94 unit images use lossless native-size WebP, retaining all visible RGB pixels and the alpha channel. The eight exterior WebPs use quality 82, longest edge at most 1920 px, no crop. Originals remain unchanged. The raster set went from **24,117,358 to 17,554,830 bytes** (27.2% smaller); the PDFs are retained byte-for-byte. [Exterior contact sheet, local only](../reports/qa/stage2/private/exterior-contact-sheet.jpg). Front elevation `_000` is a useful overview candidate; there is no approved floor-band key for that render.

## Facts and private mappings

- [`src/data/floors.json`](../src/data/floors.json): five floor groups, exact unit lists, six source hashes and viewBoxes, and paths/hashes of private plan–SVG pairs.
- [`src/data/apartments.json`](../src/data/apartments.json): source labels, dated status, published **Obračunska površina**, detail-page NP/NKP, individual PDF/PNG identity, and 757 PDF schedule rows with printed NP, coefficient K and NKP. Apartment totals include the exterior spaces listed on the sheet. For H 0.1 the PDF prints NP 85.25 m²; the detail page says 85.26 m². Both give NKP 56.41 m², which agrees with the listing area. Its terrace accounts for part of each total. The two source versions are preserved separately.
- [Verification and discrepancies](../reports/qa/stage2/verification.md). Prices, orientations, an independently verified net-interior-area figure, and a whole-floor metric scale remain unknown. A sheet's graphic scale is not a calibration of the separate web PNG.
- `public/floorplans/` and `public/overlays/` are reserved release directories. The private loopback preview serves only hash-checked WebP copies; it renders the private overlay data in place and links to the original PDFs on Sigma. No private drawing, overlay file or PDF is served in production.
