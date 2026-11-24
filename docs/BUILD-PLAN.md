# Build plan — Močire Zadar H apartment selector

**Decision:** Build an image-first selector in the existing Next.js app. A visitor chooses a floor on an exterior still, then a unit on its 2D plan. Accessible HTML links provide the full journey; registered SVG hotspots offer the same destinations on the images. The URL owns selection; GSAP handles transitions only.

This is the contract for a planned flow. Build the final experience only after Gate 3 passes. See the [progress log](../reports/progress.md) for gate decisions and check output.

- [Sigma — Močire Zadar H](https://www.sigma.hr/projekti/mocire-zadar-h/) supplies listing facts and private reference drawings. Public availability is not a release licence.
- [Kozielska apartment deep link](https://kozielska.vinode.io/Kozielska/Zone_A/Kozielska_A1V/2_06?floor=2) is the interaction reference for opening a unit with floor context and navigating back. Do not reuse its assets, copy or code.

## State, URL and navigation

| State | Example URL | Arrival and next action |
|---|---|---|
| OVERVIEW | `/` | Show the exterior still and a list of floor links. A floor band or its link opens FLOOR. |
| FLOOR | `/?floor=L02` | Show the selected plan and its unit links. A unit polygon or its link opens APARTMENT; an up link returns to OVERVIEW. |
| APARTMENT | `/?floor=L02&unit=H%202.1` | Show the source listing for `H 2.1`; an up link opens `L02` even on a cold entry. |

Resolve deep links directly. Match the decoded `unit` to the exact `unit_id` on the requested `level` in `assets/geometry/apartments.json`. Keep an invalid URL visible, explain the error and link to its nearest valid ancestor (floor or overview). Explicit navigation adds a history entry; Back/Forward restores the corresponding state. Restore focus to the originating link on return where possible.

Use named, keyboard-reachable links with visible focus and a text indication of selection. Floor and unit lists must work without imagery, SVG, animation or WebGL. Use a 300 ms cross-fade between states; switch immediately for reduced motion.

Show only sourced apartment details: unit ID, floor label, `unit_type_source_label`, status with its snapshot date, and **Obračunska površina** (published listing area). `gross_area_m2` is the storage name, not a verified gross or net measurement. Preserve flagged nulls for net area and orientation; do not infer an address or price.

## Registering images

- Pin each map to the exact image content hash and intrinsic width `W` and height `H` in pixels. Set the SVG `viewBox="0 0 W H"` and apply the same fit, scale and crop to art and overlay. Re-register a changed image or crop; pixels do not establish architectural dimensions.
- Key an OVERVIEW floor band by `(image, level)` and a FLOOR unit polygon by `(image, level, unit_id)`. The gallery plan links the same 21 L04 units as the main plan; it needs its own map, not a new floor or new units.
- Obtain a usable H exterior with a floor key and approved matching plan art and maps (or permission to register them anew). Record art display rights separately from registration rights for local proof and for release. **No H release art is cleared.** Keep raw drawings in `assets/source/`, never in `public/`; publish only first-party or explicitly cleared release derivatives.
- Do not copy Sigma coordinates, guess a polygon or auto-clip it. The main L04 map puts `H 4.5` out of bounds (y=587 on a 1920×586 image). Seek an owner-reviewed correction or record the exact key, reason, approver and list-only link. See the [source inventory](source-inventory.md).

## Optional exterior 3D

Only a documented exterior need and verified, rights-cleared input justify a Blender exterior still or a separate lazy-loaded Three.js/R3F enhancement. Keep all links and facts available on the image baseline; the default route must fetch neither Three.js nor a GLB. `/viewer` is a synthetic sandbox. Interiors, furniture, walkthroughs, video and paid generation are outside this plan.

## Work packages

Use the [workflow gates](workflow-gates.md) in order for full checks and evidence requirements. These are acceptance criteria, not results.

| Work package | Depends on | Accept when |
|---|---|---|
| G1 · Web baseline | Existing scaffold and lockfile | Lint, typecheck, unit tests and production build succeed on the scaffold. |
| G2 · Source & rights ledger | G1; actual H exterior, scoped plans, source inventory | Each image version, map permission and allowed use is recorded; unit facts join their source records. A remote candidate cannot stand in for the exterior. |
| G3 · Two SVG registrations | G2 inputs for the same scope and use | Both maps hit their intended floors/units at 1440×900 and 390×844. Per image: zero unexplained missing, invalid or duplicate entries; approved exceptions remain reachable by link. |
| G4 · Selection flow | G3 sign-off | Deep links, up links, Back/Forward, keyboard and text lists reach the intended records; missing data and invalid URLs are explicit. |
| G5 · Release art & data | G4; release manifest | Every public derivative, map and displayed field matches its approved version or sourced record; changed art or maps return to review. |
| G6 · Release QA | G5; working selector browser tests | Desktop/mobile checks cover alignment, focus, screen readers, reduced motion and missing imagery; no console errors or open critical/high findings. |
