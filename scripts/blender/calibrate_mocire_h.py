"""Calibrate 3D metric geometry for Močire Zadar H from sourced floorplans & schedules.

All metric dimensions are ESTIMATED_FROM_FLOORPLANS using the median pixel-to-meter
ratio across L01-L03 apartment polygons against sourced PDF NP (net area) schedules.
Displayed apartment areas remain strictly Sigma's sourced listing/PDF values.
"""
import json
import math
import os
import statistics
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APTS_PATH = os.path.join(ROOT, "src/data/apartments.json")
FLOORS_PATH = os.path.join(ROOT, "src/data/floors.json")
OVERLAY_DIR = os.path.join(ROOT, "assets/geometry/stage2/private/overlays")
OUT_PATH = os.path.join(ROOT, "assets/geometry/mocire-h-3d-calibration.json")

# Calibrated wall factor: polygon wraps exterior + partition walls (~13% of net area).
WALL_AREA_FACTOR = 1.13

# Floor elevations in meters (Z-up, matched to Mocire_H-Zadar_000.jpg aspect ratio).
FLOOR_BANDS = {
    "L00": {"z0": 0.0, "z1": 3.10, "label": "Prizemlje"},
    "L01": {"z0": 3.10, "z1": 6.10, "label": "Etaža 1"},
    "L02": {"z0": 6.10, "z1": 9.10, "label": "Etaža 2"},
    "L03": {"z0": 9.10, "z1": 12.10, "label": "Etaža 3"},
    "L04": {"z0": 12.10, "z1": 17.70, "label": "Etaža 4"},
}

# L00 building wall envelope inside floor-prizemlje.png (1920x688), excluding outer yards/gardens.
L00_WALL_BOX = {"x0": 141.0, "x1": 1674.0, "y0": 122.0, "y1": 561.0}
# L01-L04 main building wall envelope inside 1920x585 (excluding protruding front balconies y=558..585).
UPPER_WALL_BOX = {"x0": 1.0, "x1": 1919.0, "y0": 0.0, "y1": 558.0}


def parse_svg(svg_path):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    vb = [float(v) for v in root.attrib["viewBox"].split()]
    polys = {}
    for el in root.iter():
        if el.tag.endswith("polygon"):
            uid = el.attrib["data-unit-id"]
            pts = [tuple(map(float, p.split(","))) for p in el.attrib["points"].split()]
            area = (
                abs(
                    sum(
                        pts[i][0] * pts[(i + 1) % len(pts)][1]
                        - pts[(i + 1) % len(pts)][0] * pts[i][1]
                        for i in range(len(pts))
                    )
                )
                / 2.0
            )
            polys[uid] = {"pts": pts, "area_px2": area}
    return vb, polys


def main():
    apts_doc = json.load(open(APTS_PATH, encoding="utf-8"))
    apts_by_id = {u["unit_id"]: u for u in apts_doc["units"]}

    # 1. Calibrate px/m on L01-L03
    ratios = []
    for lvl in ("L01", "L02", "L03"):
        _, polys = parse_svg(os.path.join(OVERLAY_DIR, f"{lvl}.svg"))
        for uid, info in polys.items():
            u = apts_by_id[uid]
            np_m2 = (u.get("sheet") or {}).get("np_total_m2") or u["listing_area_m2"]
            ratios.append(math.sqrt(info["area_px2"] / (np_m2 * WALL_AREA_FACTOR)))

    px_per_m = statistics.median(ratios)
    width_m = round((UPPER_WALL_BOX["x1"] - UPPER_WALL_BOX["x0"]) / px_per_m, 3)
    depth_body_m = round((UPPER_WALL_BOX["y1"] - UPPER_WALL_BOX["y0"]) / px_per_m, 3)
    balcony_proj_m = round((584.0 - UPPER_WALL_BOX["y1"]) / px_per_m, 3)

    # Helpers to map floorplan pixel (px, py) -> Blender building metric (x, y)
    # In floorplan: x goes left->right (West->East), y goes top->bottom (North->South).
    # In Blender:   X goes 0->width_m (West->East), Y goes 0->depth_body_m (South->North).
    # So South facade is Y = 0, North facade is Y = depth_body_m.
    def map_point(level, px, py):
        box = L00_WALL_BOX if level == "L00" else UPPER_WALL_BOX
        u = (px - box["x0"]) / (box["x1"] - box["x0"])
        v = (py - box["y0"]) / (box["y1"] - box["y0"])
        x = round(u * width_m, 3)
        y = round((1.0 - v) * depth_body_m, 3)
        return [x, y]

    units_out = []
    for lvl in ("L00", "L01", "L02", "L03", "L04"):
        _, polys = parse_svg(os.path.join(OVERLAY_DIR, f"{lvl}.svg"))
        band = FLOOR_BANDS[lvl]
        for uid, info in polys.items():
            u = apts_by_id[uid]
            pts_m = [map_point(lvl, px, py) for px, py in info["pts"]]
            xs = [p[0] for p in pts_m]
            ys = [p[1] for p in pts_m]

            # Raw metric bounds (includes terraces/gardens on L00 and balconies on L01-L04)
            raw_x0, raw_x1 = min(xs), max(xs)
            raw_y0, raw_y1 = min(ys), max(ys)

            # Clamped building-envelope bounds for crisp exterior facade rectangles
            bx0 = round(max(0.0, min(width_m, raw_x0)), 3)
            bx1 = round(max(0.0, min(width_m, raw_x1)), 3)
            by0 = round(max(0.0, min(depth_body_m, raw_y0)), 3)
            by1 = round(max(0.0, min(depth_body_m, raw_y1)), 3)

            cy = (by0 + by1) / 2.0
            primary_side = "south" if cy < depth_body_m / 2.0 else "north"
            facades = [primary_side]
            if bx0 <= 0.35:
                facades.append("west")
            if bx1 >= width_m - 0.35:
                facades.append("east")

            # Room features from sourced PDF schedule
            rooms = (u.get("sheet") or {}).get("rooms") or []
            room_labels_lower = " ".join(r.get("label", "").lower() for r in rooms)
            has_balcony = "balkon" in room_labels_lower
            has_loggia = "lođa" in room_labels_lower or "loggia" in room_labels_lower
            has_terrace = "terasa" in room_labels_lower or "vrt" in room_labels_lower

            # Check if unit protrudes on south (balcony) on upper floors
            has_south_balcony = lvl != "L00" and primary_side == "south" and raw_y0 < -0.25

            # Extract south balcony x-span from polygon vertices where y < -0.25
            balcony_span = None
            if has_south_balcony:
                bxs = [p[0] for p in pts_m if p[1] < -0.25]
                if len(bxs) >= 2:
                    balcony_span = [round(min(bxs), 3), round(max(bxs), 3)]

            units_out.append({
                "unit_id": uid,
                "floor_id": lvl,
                "status": u["status"],
                "unit_type": u["unit_type_source_label"],
                "listing_area_m2": u["listing_area_m2"],
                "np_total_m2": (u.get("sheet") or {}).get("np_total_m2"),
                "primary_side": primary_side,
                "facades": facades,
                "has_balcony": has_balcony,
                "has_loggia": has_loggia,
                "has_terrace": has_terrace,
                "has_south_balcony": has_south_balcony,
                "balcony_span_x": balcony_span,
                "building_bbox_m": {
                    "x0": bx0,
                    "x1": bx1,
                    "y0": by0,
                    "y1": by1,
                    "z0": band["z0"],
                    "z1": band["z1"],
                },
                "raw_bbox_m": {
                    "x0": round(raw_x0, 3),
                    "x1": round(raw_x1, 3),
                    "y0": round(raw_y0, 3),
                    "y1": round(raw_y1, 3),
                },
                "polygon_m": pts_m,
            })

    # Sort canonically by floor then numeric unit suffix
    def sort_key(item):
        parts = item["unit_id"].replace("H ", "").split(".")
        return (item["floor_id"], int(parts[0]), int(parts[1]))

    units_out.sort(key=sort_key)

    result = {
        "schema": "mocire-h.3d-calibration/1",
        "estimation_flag": "ESTIMATED_FROM_FLOORPLANS_AND_EXTERIOR_RENDERS",
        "method": (
            "Calibrated px/m from median of 57 L01-L03 unit polygons against sourced PDF NP areas "
            f"(wall factor {WALL_AREA_FACTOR}). Floor heights matched to frontal elevation Mocire_H-Zadar_000.jpg."
        ),
        "px_per_m": round(px_per_m, 4),
        "building_m": {
            "width_x": width_m,
            "depth_y": depth_body_m,
            "balcony_proj_y": balcony_proj_m,
            "total_height_z": FLOOR_BANDS["L04"]["z1"],
            "hood_top_z": round(FLOOR_BANDS["L04"]["z1"] + 0.90, 2),
            "corridor_y": [
                round((1.0 - 305.0 / 558.0) * depth_body_m, 3),
                round((1.0 - 255.0 / 558.0) * depth_body_m, 3),
            ],
            "core_x": [
                round(845.0 / px_per_m, 3),
                round(1040.0 / px_per_m, 3),
            ],
        },
        "floors": FLOOR_BANDS,
        "unit_count": len(units_out),
        "units": units_out,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)

    print(
        f"CALIBRATED OK: {len(units_out)} units | "
        f"W={width_m}m D={depth_body_m}m H={FLOOR_BANDS['L04']['z1']}m | "
        f"scale={px_per_m:.3f} px/m | out={OUT_PATH}"
    )


if __name__ == "__main__":
    main()
