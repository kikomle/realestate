"""Pipeline tests on the SYNTHETIC 6.00 m x 4.00 m fixture and on the real Sigma apartment sheet.

Tolerances are stated explicitly. Synthetic results are labelled SYNTHETIC.
"""
from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts/pdf"
VALIDATE = ROOT / "scripts/validate/validate_geometry.py"
sys.path.insert(0, str(SCRIPTS))

from calibrate import calibrate_page  # noqa: E402
from classify_pdf import classify  # noqa: E402
from extract_vectors import extract  # noqa: E402
from pdfgeo import metres_per_pt_for_scale, parse_dimension  # noqa: E402
from reconstruct_walls import reconstruct  # noqa: E402

FIXTURE = ROOT / "tests/fixtures/synthetic_room_6x4.pdf"
CONFIG = ROOT / "tests/fixtures/synthetic_room_6x4.config.json"
TRUTH = ROOT / "tests/fixtures/synthetic_room_6x4.truth.json"
SIGMA_APT = ROOT / "assets/source/mocire-zadar-h/raw/apartment-H-0.1.pdf"
DIM_TOL = 0.01  # 1% on linear dimensions (SYNTHETIC: exact geometry, tolerance covers rasterisation)
AREA_TOL = 0.02  # 2% on area
WALL_TOL_M = 0.01  # 1 cm on wall thickness


@pytest.fixture(scope="module")
def truth():
    return json.loads(TRUTH.read_text())


@pytest.fixture(scope="module")
def raw_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("raw")
    extract(FIXTURE, out)
    return out


@pytest.fixture(scope="module")
def page(raw_dir):
    return json.loads((raw_dir / "page-001.json").read_text())


@pytest.fixture(scope="module")
def cal(page):
    return calibrate_page(page)


@pytest.fixture(scope="module")
def geo(page, cal):
    cfg = json.loads(CONFIG.read_text())
    cfg["source"]["sha256"] = "0" * 64  # hash is asserted in the runner test
    return reconstruct(page, cal, cfg)


def test_parse_dimension_units():
    assert parse_dimension("6.00 m") == (6.0, "m")
    assert parse_dimension("600 cm")[0] == pytest.approx(6.0)
    assert parse_dimension("6000 mm")[0] == pytest.approx(6.0)
    assert parse_dimension("1:100") is None


def test_scale_constant_matches_1_100():
    assert metres_per_pt_for_scale(100) == pytest.approx(0.0352777778, rel=1e-9)


def test_synthetic_classified_as_vector():
    cls = classify(FIXTURE)
    assert cls["pages"][0]["class"] == "VECTOR"


def test_synthetic_calibration_recovers_dimensions(cal, truth):
    assert cal["uncalibrated"] is False
    assert cal["method"] == "dimensions+scale_text"
    assert cal["scale_denominator"] == truth["scale_denominator"]
    assert cal["residual"] <= 0.02
    recovered = {p["text"]: p["value_m"] for p in cal["dimension_pairs"]}
    assert recovered == {"6.00 m": 6.0, "4.00 m": 4.0}
    for p in cal["dimension_pairs"]:
        assert abs(p["metres_per_pt"] - cal["metres_per_pt"]) / cal["metres_per_pt"] <= DIM_TOL


def test_synthetic_room_area_and_polygon(geo, truth):
    unit = geo["buildings"][0]["levels"][0]["units"][0]
    assert len(unit["rooms"]) == 1
    room = unit["rooms"][0]
    assert room["area_m2"] == pytest.approx(truth["room_area_m2"], rel=AREA_TOL)
    xs = [p[0] for p in room["polygon_m"]]
    ys = [p[1] for p in room["polygon_m"]]
    assert max(xs) - min(xs) == pytest.approx(truth["room_clear_m"][0], abs=0.02)
    assert max(ys) - min(ys) == pytest.approx(truth["room_clear_m"][1], abs=0.02)


def test_synthetic_wall_thickness(geo, truth):
    unit = geo["buildings"][0]["levels"][0]["units"][0]
    assert len(unit["walls"]) == 4
    for w in unit["walls"]:
        assert w["thickness_m"] == pytest.approx(truth["wall_thickness_m"], abs=WALL_TOL_M)


def test_height_and_north_are_flagged_unknown(geo):
    assert any("height_m" in m for m in geo["missing"])
    assert any("north_arrow_deg" in m for m in geo["missing"])
    assert geo["coordinate_system"]["north_arrow_source"] == "UNKNOWN"


def test_unit_id_and_wall_ids_follow_convention(geo):
    import re
    unit = geo["buildings"][0]["levels"][0]["units"][0]
    assert re.match(r"^B01__L00__U001$", unit["id"])
    for w in unit["walls"]:
        assert re.match(r"^B01__L00__U001__wall__\d{3}$", w["id"])


def test_runner_end_to_end_passes_validator(tmp_path):
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "run_pipeline.py"), str(FIXTURE), str(CONFIG), str(tmp_path)],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    geo = json.loads((tmp_path / "geometry.json").read_text())
    assert geo["source"]["sha256"] != "SET_BY_RUNNER" and len(geo["source"]["sha256"]) == 64
    assert geo["project"]["is_real_project"] is False


def test_validator_accepts_committed_synthetic_output():
    out = ROOT / "assets/geometry/synthetic-room-6x4/geometry.json"
    result = subprocess.run([sys.executable, str(VALIDATE), str(out)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout


def test_validator_rejects_uncalibrated(geo, tmp_path):
    bad = copy.deepcopy(geo)
    bad["calibration"]["uncalibrated"] = True
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    result = subprocess.run([sys.executable, str(VALIDATE), str(p)], capture_output=True, text=True)
    assert result.returncode != 0
    assert "uncalibrated" in result.stdout


def test_validator_rejects_bad_unit_name(geo, tmp_path):
    bad = copy.deepcopy(geo)
    bad["buildings"][0]["levels"][0]["units"][0]["id"] = "U001"
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    result = subprocess.run([sys.executable, str(VALIDATE), str(p)], capture_output=True, text=True)
    assert result.returncode != 0


def test_validator_rejects_open_polygon(geo, tmp_path):
    bad = copy.deepcopy(geo)
    unit = bad["buildings"][0]["levels"][0]["units"][0]
    unit["rooms"][0]["polygon_m"] = unit["rooms"][0]["polygon_m"][:-1] + [[0.0, 0.0]]
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    result = subprocess.run([sys.executable, str(VALIDATE), str(p)], capture_output=True, text=True)
    assert result.returncode != 0


def test_validator_rejects_wrong_units(geo, tmp_path):
    bad = copy.deepcopy(geo)
    bad["units"] = "ft"
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    result = subprocess.run([sys.executable, str(VALIDATE), str(p)], capture_output=True, text=True)
    assert result.returncode != 0


@pytest.mark.skipif(not SIGMA_APT.exists(), reason="Sigma source not downloaded")
def test_sigma_apartment_sheet_is_uncalibrated_and_produces_no_metric_geometry(tmp_path):
    extract(SIGMA_APT, tmp_path)
    page = json.loads((tmp_path / "page-001.json").read_text())
    cal = calibrate_page(page)
    assert cal["uncalibrated"] is True
    assert cal["metres_per_pt"] is None
    cls = classify(SIGMA_APT)["pages"][0]["class"]
    assert cls == "MIXED"
    cfg = json.loads(CONFIG.read_text())
    with pytest.raises(ValueError, match="uncalibrated"):
        reconstruct(page, cal, cfg)
