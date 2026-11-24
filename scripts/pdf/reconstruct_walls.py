#!/usr/bin/env python3
"""Reconstruct walls and room polygons from a calibrated page and emit geometry JSON.

Input: page JSON (extract_vectors), calibration JSON (calibrate), and a config JSON with
  {"source": {...}, "building": "B01", "level": "L00", "unit": "U001", "unit_label": "...",
   "origin_note": "...", "north_arrow_deg": null, "project": {...}}
Method:
  1. Filled rectangles (dark fills) are treated as wall solids.
  2. Solids are unioned with Shapely; the outer envelope is the convex hull of the union.
  3. Interior holes of the union that exceed MIN_ROOM_AREA_M2 become room polygons.
  4. Each wall rectangle contributes a centreline and thickness (its short side).
Refuses to emit metric output if calibration.uncalibrated is true.
Usage: reconstruct_walls.py <page.json> <calibration.json> <config.json> <geometry.json>
"""
from __future__ import annotations

import sys
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).parent))
from pdfgeo import MIN_ROOM_AREA_M2, read_json, write_json  # noqa: E402

DARK_FILL_MAX = 0.35  # grayscale channel threshold for wall solids


def _is_wall_fill(fill) -> bool:
    return fill is not None and len(fill) >= 3 and max(fill[:3]) <= DARK_FILL_MAX


def wall_rects(page: dict):
    rects = []
    for path in page["paths"]:
        if not _is_wall_fill(path.get("fill")):
            continue
        for it in path["items"]:
            if it["k"] == "re":
                x0, y0, x1, y1 = it["bbox"]
                rects.append((x0, y0, x1, y1))
    return rects


def reconstruct(page: dict, cal: dict, cfg: dict) -> dict:
    if cal["uncalibrated"]:
        raise ValueError("calibration.uncalibrated is true: refusing to emit metric geometry")
    mpp = cal["metres_per_pt"]
    rects = wall_rects(page)
    if not rects:
        raise ValueError("no wall solids found (no dark filled rectangles)")

    solids = unary_union([Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]) for x0, y0, x1, y1 in rects])
    envelope = solids.convex_hull
    minx, miny, maxx, maxy = envelope.bounds
    # PDF y grows downward; SW corner = (minx, maxy) in PDF coords -> origin.
    def to_m(x, y):
        return [round((x - minx) * mpp, 4), round((maxy - y) * mpp, 4)]

    flags_global = list(cal.get("flags", []))
    rooms = []
    polys = solids.geoms if hasattr(solids, "geoms") else [solids]
    for poly in polys:
        for ring in poly.interiors:
            hole = Polygon(ring)
            area_m2 = hole.area * mpp * mpp
            if area_m2 < MIN_ROOM_AREA_M2:
                continue
            ring_m = [to_m(x, y) for x, y in hole.exterior.coords]
            rooms.append({"polygon_m": ring_m, "area_m2": round(area_m2, 4)})

    walls = []
    for i, (x0, y0, x1, y1) in enumerate(rects, start=1):
        w_pt, h_pt = x1 - x0, y1 - y0
        horizontal = w_pt >= h_pt
        thickness = (h_pt if horizontal else w_pt) * mpp
        if horizontal:
            cy = (y0 + y1) / 2
            start, end = to_m(x0, cy), to_m(x1, cy)
        else:
            cx = (x0 + x1) / 2
            start, end = to_m(cx, y0), to_m(cx, y1)
        length = max(abs(end[0] - start[0]), abs(end[1] - start[1]))
        walls.append({
            "index": i,
            "start_m": start,
            "end_m": end,
            "length_m": round(length, 4),
            "thickness_m": round(thickness, 4),
            "height_m": None,
            "confidence": 0.9 if cal["method"] == "dimensions+scale_text" else 0.75,
            "flags": ["HEIGHT_UNKNOWN"],
        })

    building, level, unit = cfg["building"], cfg["level"], cfg["unit"]
    unit_id = f"{building}__{level}__{unit}"
    room_objs = []
    for j, r in enumerate(rooms, start=1):
        room_objs.append({
            "name": cfg.get("room_name", "UNNAMED"),
            "polygon_m": r["polygon_m"],
            "area_m2": r["area_m2"],
            "confidence": 0.9 if cal["method"] == "dimensions+scale_text" else 0.75,
            "flags": [] if cfg.get("room_name") else ["ROOM_NAME_UNKNOWN"],
        })
    unit_polygon = rooms[0]["polygon_m"] if rooms else None
    unit_area = rooms[0]["area_m2"] if rooms else None
    wall_objs = []
    for w in walls:
        idx = f"{w['index']:03d}"
        wall_objs.append({
            "id": f"{building}__{level}__{unit}__wall__{idx}",
            "semantic_id": f"{building}/{level}/{unit}/wall/{idx}",
            "start_m": w["start_m"],
            "end_m": w["end_m"],
            "thickness_m": w["thickness_m"],
            "height_m": None,
            "confidence": w["confidence"],
            "flags": w["flags"],
        })
    missing = [
        "height_m: no elevation/section in the source for this unit",
        "openings: window/door positions not extracted (plan window symbols not reconstructed)",
        "north_arrow_deg: UNKNOWN" if cfg.get("north_arrow_deg") is None else "north_arrow_deg: from config",
    ]
    if cfg.get("room_name") is None:
        missing.append("room names: not present in the synthetic fixture")

    return {
        "project": cfg["project"],
        "source": cfg["source"],
        "units": "m",
        "coordinate_system": {
            "origin": "south-west corner of drawn envelope" if cfg.get("origin_note") is None else cfg["origin_note"],
            "x": "east", "y": "north", "z": "up",
            "north_arrow_deg": cfg.get("north_arrow_deg"),
            "north_arrow_source": "UNKNOWN" if cfg.get("north_arrow_deg") is None else cfg.get("north_arrow_source"),
        },
        "calibration": {
            "method": cal["method"],
            "scale_denominator": cal.get("scale_denominator"),
            "metres_per_pt": cal["metres_per_pt"],
            "residual": cal["residual"],
            "uncalibrated": cal["uncalibrated"],
        },
        "buildings": [{
            "id": building,
            "levels": [{
                "id": level,
                "elevation_m": None,
                "units": [{
                    "id": unit_id,
                    "label": cfg.get("unit_label", unit),
                    "polygon_m": unit_polygon,
                    "area_m2": unit_area,
                    "rooms": room_objs,
                    "walls": wall_objs,
                    "openings": [],
                    "confidence": 0.9 if cal["method"] == "dimensions+scale_text" else 0.75,
                    "flags": flags_global,
                }],
            }],
        }],
        "missing": missing,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__)
        return 2
    page = read_json(Path(argv[0]))
    cal = read_json(Path(argv[1]))
    cfg = read_json(Path(argv[2]))
    geo = reconstruct(page, cal, cfg)
    write_json(Path(argv[3]), geo)
    print(f"wrote {argv[3]}: rooms={len(geo['buildings'][0]['levels'][0]['units'][0]['rooms'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
