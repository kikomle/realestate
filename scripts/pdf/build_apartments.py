#!/usr/bin/env python3
"""Build assets/geometry/apartments.json from the sourced inventory.

Only sourced values are copied:
- gross_area_m2 = listing value "Obračunska površina" (m², comma decimal) from the floor page table.
  On the H 0.1 detail sheet the matching total is labelled "Sveukupno NKP stana: 56,41" (56.41 m²),
  so the listing figure is used as-is and the label is recorded in unit_type_source_label-style notes.
- net_area_m2 is null for every unit: the listing does not publish a net figure; the H 0.1 sheet
  shows NP 85.25 m² (incl. terrace at 0.25) and a room-by-room net list, which is not a per-unit net total.
- building = "B01" is assigned by this pipeline's naming convention (the source names no building).
- orientation is null for every unit (not in source).
Usage: build_apartments.py <inventory.json> <out.json>
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pdfgeo import read_json, write_json  # noqa: E402

LEVEL_BY_SLUG = {"prizemlje": "L00", "etaza-1": "L01", "etaza-2": "L02", "etaza-3": "L03", "etaza-4": "L04"}
UNIT_TYPE_BY_LABEL = {"Dvosoban": "2-room", "Trosoban": "3-room", "Četverosoban": "4-room", "Peterosoban": "5-room"}
STATUS_ALLOWED = {"Slobodno", "Prodano"}


def _area(raw: str | None) -> float | None:
    if not raw:
        return None
    return float(raw.replace(".", "").replace(",", ".")) if raw.count(",") == 1 and "." not in raw else float(raw.replace(",", "."))


def build(inv: dict) -> dict:
    units = []
    for fl in inv["floors"]:
        slug = fl["page_url"].rstrip("/").rsplit("/", 1)[-1]
        level = LEVEL_BY_SLUG[slug]
        for u in fl["units"]:
            units.append({
                "unit_id": u["label"],
                "building": "B01",
                "level": level,
                "unit_type": UNIT_TYPE_BY_LABEL.get(u["rooms_label"]),
                "unit_type_source_label": u["rooms_label"],
                "net_area_m2": None,
                "gross_area_m2": _area(u["gross_area_raw"]),
                "orientation": None,
                "status": u["status_raw"] if u["status_raw"] in STATUS_ALLOWED else None,
                "property_type": u["property_type"],
                "source_ref": u["detail_url"],
                "flags": ["AREA_NET_UNVERIFIED", "ORIENTATION_UNKNOWN", "AREA_BASIS_NOT_CONFIRMED"],
            })
    return {"project": "Mocire Zadar - H", "retrieved_at": inv["retrieved_at"], "units": units}


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    out = build(read_json(Path(argv[0])))
    write_json(Path(argv[1]), out)
    print(f"wrote {len(out['units'])} units to {argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
