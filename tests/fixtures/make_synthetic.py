#!/usr/bin/env python3
"""Generate SYNTHETIC vector fixture: 6.00 m x 4.00 m clear room, 0.20 m walls, drawn at 1:100.

Output: tests/fixtures/synthetic_room_6x4.pdf and synthetic_room_6x4.truth.json (ground truth).
Everything here is invented for testing; it is not a real building.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "scripts/pdf"))
from pdfgeo import metres_per_pt_for_scale, write_json  # noqa: E402

SCALE = 100
WALL = 0.20
CLEAR_W, CLEAR_H = 6.00, 4.00
PT_PER_M = 1.0 / metres_per_pt_for_scale(SCALE)  # PDF points per real metre at 1:100

# Origin: SW outer corner of the wall envelope, real metres, X east, Y north.
ENV_W = CLEAR_W + 2 * WALL
ENV_H = CLEAR_H + 2 * WALL


def to_pdf(x_m: float, y_m: float, origin: tuple[float, float], height_pt: float) -> tuple[float, float]:
    ox, oy = origin
    return (ox + x_m * PT_PER_M, oy + (ENV_H - y_m) * PT_PER_M)


def build(out_pdf: Path, out_truth: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=595.28, height=841.89)
    ox, oy = 150.0, 200.0  # top-left of the envelope in PDF points (y down)
    shape = page.new_shape()

    def rect_m(x0, y0, x1, y1):
        p0 = to_pdf(x0, y1, (ox, oy), 0)
        p1 = to_pdf(x1, y0, (ox, oy), 0)
        return fitz.Rect(p0[0], p0[1], p1[0], p1[1])

    # four wall rectangles (filled), envelope minus clear room
    walls = [
        (0.0, ENV_H - WALL, ENV_W, ENV_H),   # north
        (0.0, 0.0, ENV_W, WALL),             # south
        (0.0, 0.0, WALL, ENV_H),             # west
        (ENV_W - WALL, 0.0, ENV_W, ENV_H),   # east
    ]
    for w in walls:
        shape.draw_rect(rect_m(*w))
    shape.finish(color=None, fill=(0, 0, 0), width=0)
    shape.commit()

    # dimension lines, drawn at true length (6.00 m and 4.00 m at 1:100)
    shape = page.new_shape()
    y_dim = -0.8  # metres below the envelope's south edge (real metres)
    a = to_pdf(WALL, y_dim, (ox, oy), 0)
    b = to_pdf(WALL + CLEAR_W, y_dim, (ox, oy), 0)
    shape.draw_line(fitz.Point(*a), fitz.Point(*b))
    x_dim = ENV_W + 0.8
    c = to_pdf(x_dim, WALL, (ox, oy), 0)
    d = to_pdf(x_dim, WALL + CLEAR_H, (ox, oy), 0)
    shape.draw_line(fitz.Point(*c), fitz.Point(*d))
    shape.finish(color=(0, 0, 0), width=0.5)
    shape.commit()

    page.insert_text(((a[0] + b[0]) / 2 - 12, a[1] - 3), "6.00 m", fontsize=9, fontname="helv")
    page.insert_text((c[0] + 4, (c[1] + d[1]) / 2 + 4), "4.00 m", fontsize=9, fontname="helv")
    page.insert_text((ox, oy - 40), f"SYNTHETIC TEST FIXTURE  1:{SCALE}", fontsize=10, fontname="helv")
    page.insert_text((ox, oy - 26), "Synthetic room 6.00 x 4.00 m, walls 0.20 m", fontsize=9, fontname="helv")

    doc.save(out_pdf, garbage=3, deflate=True)
    doc.close()

    truth = {
        "synthetic": True,
        "description": "SYNTHETIC: 6.00 m x 4.00 m clear room, 0.20 m walls, drawn at 1:100",
        "scale_denominator": SCALE,
        "wall_thickness_m": WALL,
        "room_clear_m": [CLEAR_W, CLEAR_H],
        "room_polygon_m": [[WALL, WALL], [WALL + CLEAR_W, WALL], [WALL + CLEAR_W, WALL + CLEAR_H], [WALL, WALL + CLEAR_H]],
        "room_area_m2": CLEAR_W * CLEAR_H,
        "envelope_m": [ENV_W, ENV_H],
        "origin": "SW outer corner of wall envelope",
    }
    write_json(out_truth, truth)


if __name__ == "__main__":
    build(HERE / "synthetic_room_6x4.pdf", HERE / "synthetic_room_6x4.truth.json")
    print("wrote synthetic fixture")
