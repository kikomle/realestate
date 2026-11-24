#!/usr/bin/env python3
"""End-to-end: PDF page -> classify -> extract -> calibrate -> reconstruct -> validate.

Usage: run_pipeline.py <pdf> <config.json> <out_dir>
- config.json: same keys as reconstruct_walls.py; source.sha256 is filled in from the file.
- Writes: out_dir/{classify.json, raw/page-NNN.json, calibration.json, geometry.json}
- Exits non-zero when calibration is uncalibrated (no metric geometry is written in that case)
  or when the validator rejects the output.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import fitz

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from pdfgeo import read_json, sha256_file, write_json  # noqa: E402
from calibrate import calibrate_page  # noqa: E402
from classify_pdf import classify  # noqa: E402
from extract_vectors import extract  # noqa: E402
from reconstruct_walls import reconstruct  # noqa: E402

ROOT = HERE.parents[1]
VALIDATOR = ROOT / "scripts/validate/validate_geometry.py"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    pdf, cfg_path, out = Path(argv[0]), Path(argv[1]), Path(argv[2])
    out.mkdir(parents=True, exist_ok=True)
    cfg = read_json(cfg_path)
    cfg["source"]["sha256"] = sha256_file(pdf)
    cfg["source"]["file"] = str(pdf.relative_to(ROOT)) if pdf.is_relative_to(ROOT) else str(pdf)

    write_json(out / "classify.json", classify(pdf))
    index = extract(pdf, out / "raw")
    page_no = cfg["source"].get("page", 1)
    page = read_json(out / "raw" / f"page-{page_no:03d}.json")
    cal = calibrate_page(page)
    cal["source_page_file"] = f"raw/page-{page_no:03d}.json"
    write_json(out / "calibration.json", cal)
    if cal["uncalibrated"]:
        print("UNCALIBRATED: no metric geometry written", file=sys.stderr)
        return 3
    geo = reconstruct(page, cal, cfg)
    write_json(out / "geometry.json", geo)
    result = subprocess.run([sys.executable, str(VALIDATOR), str(out / "geometry.json")], check=False)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
