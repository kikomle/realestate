#!/usr/bin/env python3
"""Validate geometry JSON against the schema and the project rules.

Checks:
1. JSON Schema (2020-12) against assets/geometry/schema/geometry.schema.json
2. Object-name regex on every unit/wall/opening id (B01__L00__U001__wall__001 pattern)
3. Polygon rings are closed (first == last) with >= 3 distinct vertices
4. Areas are non-negative and match the shoelace area of their polygon within 1%
5. units == "m"
6. calibration.uncalibrated == false before any metric output is accepted
7. Flags vocabulary (enforced by schema)
Exit 0 on pass; non-zero on failure, printing every failure.
Usage: validate_geometry.py <geometry.json> [--apartments <apartments.json>]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "assets/geometry/schema/geometry.schema.json"
APT_SCHEMA = ROOT / "assets/geometry/schema/apartments.schema.json"
NAME_RE = re.compile(r"^B[0-9]{2}__(L[0-9]{2}|LM[0-9]{2})__(U[0-9]{3}|NONE)__(wall|slab|window|door|balcony|stair|column|roof|site)__[0-9]{3}$")
UNIT_ID_RE = re.compile(r"^B[0-9]{2}__(L[0-9]{2}|LM[0-9]{2})__(U[0-9]{3}|NONE)$")
AREA_TOL = 0.01


def shoelace(ring: list[list[float]]) -> float:
    s = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        s += x0 * y1 - x1 * y0
    return abs(s) / 2.0


def check_ring(ring, where: str, errors: list[str]) -> None:
    if ring is None:
        return
    if ring[0] != ring[-1]:
        errors.append(f"{where}: polygon not closed (first != last)")
    if len({tuple(p) for p in ring}) < 3:
        errors.append(f"{where}: fewer than 3 distinct vertices")


def validate(geo: dict) -> list[str]:
    errors: list[str] = []
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    for e in sorted(Draft202012Validator(schema).iter_errors(geo), key=lambda e: list(e.path)):
        errors.append(f"schema: {'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}")

    if geo.get("units") != "m":
        errors.append(f"units must be 'm', got {geo.get('units')!r}")
    cal = geo.get("calibration", {})
    if cal.get("uncalibrated") is not False:
        errors.append("calibration.uncalibrated must be false before metric output is allowed")

    for b in geo.get("buildings", []):
        for lv in b.get("levels", []):
            for u in lv.get("units", []):
                uid = u.get("id", "?")
                if not UNIT_ID_RE.match(uid):
                    errors.append(f"unit id fails naming convention: {uid}")
                check_ring(u.get("polygon_m"), f"{uid}.polygon_m", errors)
                if u.get("polygon_m") and u.get("area_m2") is not None:
                    a = shoelace(u["polygon_m"])
                    if a < 0:
                        errors.append(f"{uid}: negative area")
                    if u["area_m2"] and abs(a - u["area_m2"]) / u["area_m2"] > AREA_TOL:
                        errors.append(f"{uid}: area_m2={u['area_m2']} disagrees with polygon area {a:.4f}")
                for r in u.get("rooms", []):
                    check_ring(r["polygon_m"], f"{uid}/{r['name']}.polygon_m", errors)
                    a = shoelace(r["polygon_m"])
                    if abs(a - r["area_m2"]) / max(r["area_m2"], 1e-9) > AREA_TOL:
                        errors.append(f"{uid}/{r['name']}: area_m2={r['area_m2']} vs polygon {a:.4f}")
                for w in u.get("walls", []):
                    if not NAME_RE.match(w["id"]):
                        errors.append(f"wall id fails naming convention: {w['id']}")
                for o in u.get("openings", []):
                    if not NAME_RE.match(o["id"]):
                        errors.append(f"opening id fails naming convention: {o['id']}")
    return errors


def validate_apartments(apt: dict) -> list[str]:
    schema = json.loads(APT_SCHEMA.read_text(encoding="utf-8"))
    errs = []
    for e in sorted(Draft202012Validator(schema).iter_errors(apt), key=lambda e: list(e.path)):
        errs.append(f"apartments schema: {'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}")
    for u in apt.get("units", []):
        if u.get("net_area_m2") is None and "AREA_NET_UNVERIFIED" not in u.get("flags", []):
            errs.append(f"{u.get('unit_id')}: null net_area_m2 without AREA_NET_UNVERIFIED flag")
        if u.get("source_ref") in (None, ""):
            errs.append(f"{u.get('unit_id')}: missing source_ref")
    return errs


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    geo_path = Path(argv[0])
    geo = json.loads(geo_path.read_text(encoding="utf-8"))
    errors = validate(geo)
    if "--apartments" in argv:
        apt_path = Path(argv[argv.index("--apartments") + 1])
        errors += validate_apartments(json.loads(apt_path.read_text(encoding="utf-8")))
    if errors:
        print(f"FAIL {geo_path}")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"PASS {geo_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
