#!/usr/bin/env python3
"""Calibrate PDF points to metres from scale text and/or dimension annotations.

Input: one page JSON from extract_vectors.py.
Method A (scale text): a "1:N" string gives metres_per_pt = N * 0.0254 / 72.
Method B (dimensions): each standalone "<value> m|cm|mm" text is matched to the nearest
  straight line segment; metres_per_pt = value_m / segment_length_pt.
Residual = max relative disagreement between the two methods and between dimension pairs.
uncalibrated=true whenever no dimension pair exists. Residual > 2% is flagged.

Usage: calibrate.py <page.json> <out.json>
"""
from __future__ import annotations

import math
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pdfgeo import MAX_RESIDUAL, SCALE_RE, metres_per_pt_for_scale, parse_dimension, read_json, write_json  # noqa: E402

MATCH_RADIUS_PT = 60.0


def _segments(page: dict):
    segs = []
    for path in page["paths"]:
        for it in path["items"]:
            if it["k"] == "l":
                (x0, y0), (x1, y1) = it["p"]
                segs.append((x0, y0, x1, y1))
    return segs


def _nearest_segment(text_bbox, segs):
    cx = (text_bbox[0] + text_bbox[2]) / 2
    cy = (text_bbox[1] + text_bbox[3]) / 2
    best, best_d = None, MATCH_RADIUS_PT
    for s in segs:
        x0, y0, x1, y1 = s
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        d = math.hypot(mx - cx, my - cy)
        if d < best_d:
            best, best_d = s, d
    return best


def calibrate_page(page: dict) -> dict:
    flags: list[str] = []
    scale_denoms = []
    for t in page["texts"]:
        for m in SCALE_RE.finditer(t["text"]):
            scale_denoms.append(int(m.group(1)))
    mpp_scale = metres_per_pt_for_scale(scale_denoms[0]) if scale_denoms else None

    segs = _segments(page)
    pairs = []
    for t in page["texts"]:
        parsed = parse_dimension(t["text"])
        if not parsed:
            continue
        value_m, unit = parsed
        seg = _nearest_segment(t["bbox"], segs)
        if seg is None:
            flags.append(f"DIM_NO_SEGMENT: '{t['text']}' has no nearby line")
            continue
        length_pt = math.hypot(seg[2] - seg[0], seg[3] - seg[1])
        if length_pt < 1e-6:
            continue
        pairs.append({"text": t["text"], "value_m": value_m, "unit": unit,
                      "segment_pt": round(length_pt, 4), "metres_per_pt": value_m / length_pt})

    if not pairs:
        flags.append("NO_DIMENSIONS: no linear dimension matched to a segment; uncalibrated")
        return {
            "method": "none",
            "scale_denominator": scale_denoms[0] if scale_denoms else None,
            "metres_per_pt": None,
            "residual": None,
            "uncalibrated": True,
            "dimension_pairs": [],
            "flags": flags,
        }

    mpp_dim = statistics.median(p["metres_per_pt"] for p in pairs)
    residuals = [abs(p["metres_per_pt"] - mpp_dim) / mpp_dim for p in pairs]
    for p in pairs:
        p["relative_error_vs_median"] = round(abs(p["metres_per_pt"] - mpp_dim) / mpp_dim, 6)
    residual = max(residuals)
    method = "dimensions"
    if mpp_scale is not None:
        scale_residual = abs(mpp_scale - mpp_dim) / mpp_scale
        residual = max(residual, scale_residual)
        method = "dimensions+scale_text"
        if scale_residual > MAX_RESIDUAL:
            flags.append(f"SCALE_MISMATCH: scale text 1:{scale_denoms[0]} vs dimensions differ by {scale_residual:.2%}")
    if residual > MAX_RESIDUAL:
        flags.append(f"RESIDUAL_OVER_2PCT: {residual:.2%}")
    units = {p["unit"] for p in pairs}
    return {
        "method": method,
        "scale_denominator": scale_denoms[0] if scale_denoms else None,
        "metres_per_pt": mpp_dim,
        "metres_per_pt_from_scale_text": mpp_scale,
        "residual": round(residual, 6),
        "uncalibrated": False,
        "dimension_pairs": pairs,
        "dimension_units_seen": sorted(units),
        "flags": flags,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    page = read_json(Path(argv[0]))
    result = calibrate_page(page)
    result["source_page_file"] = str(argv[0])
    write_json(Path(argv[1]), result)
    state = "UNCALIBRATED" if result["uncalibrated"] else f"calibrated residual={result['residual']:.4%}"
    print(f"{state}; pairs={len(result['dimension_pairs'])}; flags={result['flags']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
