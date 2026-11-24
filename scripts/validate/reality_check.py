#!/usr/bin/env python3
"""Reality check: compare geometry JSON against its source plan and an optional Blender manifest.

Verdicts:
- REJECTED   : a check failed against a source that is present and calibrated (numeric mismatch),
               or the geometry fails schema/unit/calibration gates.
- UNVERIFIED : the claim cannot be checked because a source or manifest is missing, uncalibrated,
               or the check has no reference value. This is the honest default.
- VERIFIED   : every requested check passed against a present, calibrated source.
The word "architecturally accurate" is only ever printed with VERIFIED and a calibrated source.

Checks (each records pass/fail/skip + reason):
  dimensions   : room/unit polygon span vs. source dimension strings (metres)
  floor_count  : manifest levels vs geometry levels
  openings     : manifest openings count vs geometry openings (only if geometry has openings)
  unit_positions: manifest unit anchor vs geometry unit centroid, tolerance 0.10 m
  source_fidelity: IoU of room polygon vs. source mask (only if a source mask is provided)

Usage: reality_check.py <geometry.json> [--manifest <blender.manifest.json>] [--source-mask <mask.json>] [--report <out.md>]
Exit: 0 VERIFIED, 1 UNVERIFIED, 2 REJECTED.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/validate"))
from validate_geometry import validate as validate_schema  # noqa: E402

DIM_TOL_M = 0.02
POSITION_TOL_M = 0.10
IOU_MIN = 0.90


def _poly_span(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return max(xs) - min(xs), max(ys) - min(ys)


def _centroid(ring):
    xs = [p[0] for p in ring[:-1]]
    ys = [p[1] for p in ring[:-1]]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _iou(a_ring, b_ring):
    from shapely.geometry import Polygon
    a, b = Polygon(a_ring), Polygon(b_ring)
    if not a.is_valid or not b.is_valid or a.union(b).area == 0:
        return None
    return a.intersection(b).area / a.union(b).area


def check_dimensions(geo: dict, source_dims: dict | None) -> dict:
    if not source_dims:
        return {"check": "dimensions", "result": "skip", "reason": "no source dimension strings supplied"}
    unit = geo["buildings"][0]["levels"][0]["units"][0]
    span_w, span_h = _poly_span(unit["rooms"][0]["polygon_m"]) if unit["rooms"] else (None, None)
    failures = []
    for key, expected in source_dims.items():
        measured = {"width_m": span_w, "height_m": span_h}.get(key)
        if measured is None:
            failures.append(f"{key}: geometry has no measurement")
        elif abs(measured - expected) > DIM_TOL_M:
            failures.append(f"{key}: geometry {measured:.3f} m vs source {expected:.3f} m")
    return {"check": "dimensions", "result": "fail" if failures else "pass", "reason": "; ".join(failures) or "within tolerance",
            "tolerance_m": DIM_TOL_M}


def check_floor_count(geo: dict, manifest: dict | None) -> dict:
    if manifest is None or "levels" not in manifest:
        return {"check": "floor_count", "result": "skip", "reason": "no Blender manifest"}
    g = len(geo["buildings"][0]["levels"])
    m = len(manifest["levels"])
    return {"check": "floor_count", "result": "pass" if g == m else "fail", "reason": f"geometry={g} manifest={m}"}


def check_openings(geo: dict, manifest: dict | None) -> dict:
    if manifest is None or "openings" not in manifest:
        return {"check": "openings", "result": "skip", "reason": "no Blender manifest"}
    g = sum(len(u["openings"]) for lv in geo["buildings"][0]["levels"] for u in lv["units"])
    if g == 0:
        return {"check": "openings", "result": "skip", "reason": "geometry has no openings (OPENINGS_UNKNOWN)"}
    m = len(manifest["openings"])
    return {"check": "openings", "result": "pass" if g == m else "fail", "reason": f"geometry={g} manifest={m}"}


def check_unit_positions(geo: dict, manifest: dict | None) -> dict:
    if manifest is None or "units" not in manifest:
        return {"check": "unit_positions", "result": "skip", "reason": "no Blender manifest"}
    fails = []
    checked = 0
    geo_units = {u["id"]: u for lv in geo["buildings"][0]["levels"] for u in lv["units"]}
    for mu in manifest["units"]:
        g = geo_units.get(mu["id"])
        if g is None or not g.get("polygon_m"):
            continue
        checked += 1
        gx, gy = _centroid(g["polygon_m"])
        mx, my = mu["position_m"]
        d = ((gx - mx) ** 2 + (gy - my) ** 2) ** 0.5
        if d > POSITION_TOL_M:
            fails.append(f"{mu['id']}: off by {d:.3f} m")
    if checked == 0:
        return {"check": "unit_positions", "result": "skip", "reason": "no unit ids shared with manifest"}
    return {"check": "unit_positions", "result": "fail" if fails else "pass",
            "reason": "; ".join(fails) or f"{checked} units within {POSITION_TOL_M} m", "tolerance_m": POSITION_TOL_M}


def check_source_fidelity(geo: dict, source_mask: dict | None) -> dict:
    if not source_mask or "polygon_m" not in source_mask:
        return {"check": "source_fidelity", "result": "skip", "reason": "no source mask polygon supplied"}
    unit = geo["buildings"][0]["levels"][0]["units"][0]
    if not unit["rooms"]:
        return {"check": "source_fidelity", "result": "fail", "reason": "no room polygon to compare"}
    iou = _iou(unit["rooms"][0]["polygon_m"], source_mask["polygon_m"])
    if iou is None:
        return {"check": "source_fidelity", "result": "fail", "reason": "invalid polygon for IoU"}
    return {"check": "source_fidelity", "result": "pass" if iou >= IOU_MIN else "fail",
            "reason": f"IoU={iou:.4f} (min {IOU_MIN})", "iou": round(iou, 6)}


def verdict(geo: dict, checks: list[dict]) -> tuple[str, list[str]]:
    reasons = []
    schema_errs = validate_schema(geo)
    if schema_errs:
        return "REJECTED", [f"validator: {e}" for e in schema_errs]
    cal = geo["calibration"]
    source_present = bool(geo.get("source", {}).get("file"))
    if cal["uncalibrated"]:
        return "UNVERIFIED", ["calibration.uncalibrated=true: no metric claims can be verified"]
    if not source_present:
        return "UNVERIFIED", ["no source file referenced"]
    failed = [c for c in checks if c["result"] == "fail"]
    if failed:
        return "REJECTED", [f"{c['check']}: {c['reason']}" for c in failed]
    if not any(c["result"] == "pass" for c in checks):
        return "UNVERIFIED", ["no check could be executed (all skipped); sources or manifest missing"]
    skipped = [c["check"] for c in checks if c["result"] == "skip"]
    if skipped:
        reasons.append(f"checks skipped (not verified): {', '.join(skipped)}")
        return "UNVERIFIED", reasons
    return "VERIFIED", ["all requested checks passed against a calibrated source"]


def run(geo: dict, manifest: dict | None, source_mask: dict | None, source_dims: dict | None) -> dict:
    checks = [
        check_dimensions(geo, source_dims),
        check_floor_count(geo, manifest),
        check_openings(geo, manifest),
        check_unit_positions(geo, manifest),
        check_source_fidelity(geo, source_mask),
    ]
    v, reasons = verdict(geo, checks)
    out = {"verdict": v, "reasons": reasons, "checks": checks}
    if v == "VERIFIED":
        out["statement"] = "architecturally accurate (for the checked properties only)"
    return out


def _load(arg: str | None):
    if not arg:
        return None
    if arg.lstrip().startswith("{") or arg.lstrip().startswith("["):
        return json.loads(arg)
    return json.loads(Path(arg).read_text(encoding="utf-8"))


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    geo = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    def opt(name):
        return argv[argv.index(name) + 1] if name in argv else None
    manifest = _load(opt("--manifest"))
    mask = _load(opt("--source-mask"))
    dims = _load(opt("--source-dims"))
    result = run(geo, manifest, mask, dims)
    report = opt("--report")
    lines = [f"# Reality check: {argv[0]}", "", f"**Verdict: {result['verdict']}**", ""]
    lines += [f"- {r}" for r in result["reasons"]]
    lines += ["", "| check | result | reason |", "|---|---|---|"]
    lines += [f"| {c['check']} | {c['result']} | {c['reason']} |" for c in result["checks"]]
    text = "\n".join(lines) + "\n"
    if report:
        Path(report).parent.mkdir(parents=True, exist_ok=True)
        Path(report).write_text(text, encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return {"VERIFIED": 0, "UNVERIFIED": 1, "REJECTED": 2}[result["verdict"]]


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
