"""Shared helpers for the architectural PDF pipeline: units, parsing, hashing, JSON IO."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

PT_PER_INCH = 72.0
M_PER_INCH = 0.0254
UNIT_TO_M = {"mm": 0.001, "cm": 0.01, "m": 1.0}
DIM_RE = re.compile(r"^\s*(\d{1,5}(?:[.,]\d{1,3})?)\s*(mm|cm|m)\s*$", re.IGNORECASE)
SCALE_RE = re.compile(r"\b1\s*:\s*(\d{2,5})\b")
AREA_RE = re.compile(r"\bm\s*(?:²|2)\b", re.IGNORECASE)
MAX_RESIDUAL = 0.02
MIN_ROOM_AREA_M2 = 1.0


def metres_per_pt_for_scale(denominator: int) -> float:
    """Real-world metres represented by one PDF point at a 1:denominator drawing scale."""
    return denominator * M_PER_INCH / PT_PER_INCH


def parse_dimension(text: str):
    """Return (metres, unit) for a standalone linear dimension string like '6.00 m', else None."""
    m = DIM_RE.match(text)
    if not m:
        return None
    value = float(m.group(1).replace(",", "."))
    unit = m.group(2).lower()
    return value * UNIT_TO_M[unit], unit


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path, obj) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
