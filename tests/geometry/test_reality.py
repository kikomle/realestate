"""Verdict logic tests for scripts/validate/reality_check.py (VERIFIED / UNVERIFIED / REJECTED)."""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/validate"))
from reality_check import run  # noqa: E402

GEO = ROOT / "assets/geometry/synthetic-room-6x4/geometry.json"


def _geo():
    return json.loads(GEO.read_text())


def _centroid(ring):
    pts = ring[:-1]
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def _manifest(geo, levels=1, position_offset=0.0):
    u = geo["buildings"][0]["levels"][0]["units"][0]
    cx, cy = _centroid(u["rooms"][0]["polygon_m"])
    return {
        "levels": [{"id": f"L{i:02d}"} for i in range(levels)],
        "openings": [],
        "units": [{"id": u["id"], "position_m": [cx + position_offset, cy]}],
    }


def test_dimension_mismatch_is_rejected():
    r = run(_geo(), None, None, {"width_m": 6.5, "height_m": 4.0})
    assert r["verdict"] == "REJECTED"
    assert any("width_m" in x for x in r["reasons"])


def test_matching_dimensions_alone_stay_unverified():
    r = run(_geo(), None, None, {"width_m": 6.0, "height_m": 4.0})
    assert r["verdict"] == "UNVERIFIED"
    assert "statement" not in r


def test_uncalibrated_geometry_never_verified():
    g = _geo()
    g["calibration"]["uncalibrated"] = True
    g["calibration"]["metres_per_pt"] = None
    r = run(g, None, None, {"width_m": 6.0, "height_m": 4.0})
    assert r["verdict"] in ("UNVERIFIED", "REJECTED")
    assert r["verdict"] != "VERIFIED"
    assert "architecturally accurate" not in json.dumps(r)


def test_floor_count_mismatch_is_rejected():
    g = _geo()
    r = run(g, _manifest(g, levels=2), None, {"width_m": 6.0, "height_m": 4.0})
    assert r["verdict"] == "REJECTED"


def test_unit_position_offset_is_rejected():
    g = _geo()
    r = run(g, _manifest(g, position_offset=0.5), None, {"width_m": 6.0, "height_m": 4.0})
    assert r["verdict"] == "REJECTED"


def test_missing_source_is_unverified_even_with_matching_manifest():
    g = _geo()
    g = copy.deepcopy(g)
    g["source"]["file"] = ""
    r = run(g, _manifest(g), None, {"width_m": 6.0, "height_m": 4.0})
    assert r["verdict"] == "UNVERIFIED"


def test_schema_break_is_rejected():
    g = _geo()
    g["units"] = "ft"
    r = run(g, None, None, {"width_m": 6.0, "height_m": 4.0})
    assert r["verdict"] == "REJECTED"
