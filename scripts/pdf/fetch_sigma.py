#!/usr/bin/env python3
"""Fetch the public Močire Zadar – H floor pages and the drawings they link to.

Scope (robots.txt: "User-agent: * / Disallow:" empty, so all paths are allowed):
- 5 floor pages (prizemlje, etaza-1..4) -> apartment rows embedded in the page's Angular data array
- the floor-plan PNG linked from each floor page
- one apartment-detail PDF (H 0.1) as a representative spec sheet
Each download gets a sidecar <file>.provenance.json with URL, retrieved_at, sha256, licence note.
Writes assets/source/mocire-zadar-h/inventory.json. Polite: 1 request/second, identifiable UA.
"""
from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import certifi

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from pdfgeo import sha256_file, write_json  # noqa: E402

BASE = "https://www.sigma.hr/projekti/mocire-zadar-h"
UA = "Mozilla/5.0 (local-prototype-research; contact: project owner; no bulk crawl)"
RAW = ROOT / "assets/source/mocire-zadar-h/raw"
INVENTORY = ROOT / "assets/source/mocire-zadar-h/inventory.json"
LICENCE = "publicly available on sigma.hr; local prototype use only; not for redistribution"

FLOORS = [
    # slug, label, level (ground = L00 by convention; upper levels by position), floor PNG
    ("prizemlje", "Prizemlje", "L00", "Mocire-Zadar-H-Tlocrt-prizemlja.png"),
    ("etaza-1", "Etaža 1", "L01", "Mocire-Zadar-H-Tlocrt-prvog-kata.png"),
    ("etaza-2", "Etaža 2", "L02", "Mocire-Zadar-H-Tlocrt-drugog-kata.png"),
    ("etaza-3", "Etaža 3", "L03", "Mocire-Zadar-H-Tlocrt-treceg-kata.png"),
    ("etaza-4", "Etaža 4", "L04", "Mocire-Zadar-H-Tlocrt-cetvrtog-kata.png"),
]
EXTRA_IMAGES = ["Mocire-Zadar-H-Tlocrt-galerije.png"]
DETAIL_PDF = ("H-0-1", "Mocire-Zadar-H-0.1.pdf")
UPLOADS = "https://www.sigma.hr/wp-content/uploads/2025/10"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
        return resp.read()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save(url: str, name: str, kind: str, page_ref: str, description: str) -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    dest = RAW / name
    dest.write_bytes(fetch(url))
    time.sleep(1.0)
    digest = sha256_file(dest)
    retrieved = now_iso()
    sidecar = {
        "file": name,
        "source_url": url,
        "linked_from": page_ref,
        "retrieved_at": retrieved,
        "sha256": digest,
        "bytes": dest.stat().st_size,
        "type": kind,
        "description": description,
        "licence_note": LICENCE,
    }
    write_json(RAW / f"{name}.provenance.json", sidecar)
    return sidecar


def parse_floor(html: str) -> list[dict]:
    m = re.search(r"\$scope\.data = (\[[\s\S]*?\]);", html)
    if not m:
        raise RuntimeError("apartment data array not found")
    rows = json.loads(m.group(1).replace("\\/", "/"))
    return [{
        "label": r["naziv"],
        "rooms_label": r["sobnost"],
        "property_type": r["tip_nekretnine"],
        "status_raw": r["status"],
        "gross_area_raw": r["povrsina"],
        "detail_url": r["link"],
    } for r in rows]


def main() -> int:
    inventory = {"retrieved_at": now_iso(), "licence": LICENCE, "robots_txt": "User-agent: * Disallow: (empty; all allowed)",
                 "source_page": f"{BASE}/", "floors": [], "downloads": []}
    for slug, label, level, png in FLOORS:
        url = f"{BASE}/{slug}/"
        html = fetch(url).decode("utf-8")
        time.sleep(1.0)
        units = parse_floor(html)
        png_url = f"{UPLOADS}/{png}"
        dl = save(png_url, f"floor-{slug}.png", "raster image (floor plan)", url,
                  f"{label} floor plan, sheet with apartment key; raster PNG, no linear dimensions")
        inventory["downloads"].append(dl)
        inventory["floors"].append({
            "floor_label": label, "level": level, "page_url": url,
            "floor_plan_file": f"floor-{slug}.png", "units": units,
            "available_badge_count": sum(1 for u in units if u["status_raw"] == "Slobodno"),
        })
    for png in EXTRA_IMAGES:
        inventory["downloads"].append(save(f"{UPLOADS}/{png}", "floor-galerije.png", "raster image (plan)",
                                           f"{BASE}/prizemlje/", "Gallery-level plan, raster PNG"))
    detail_slug, pdf_name = DETAIL_PDF
    inventory["downloads"].append(save(f"{UPLOADS}/{pdf_name}", "apartment-H-0.1.pdf", "vector PDF (apartment sheet)",
                                       f"{BASE}/prizemlje/{detail_slug.lower()}/",
                                       "Apartment H 0.1 sheet: room list with net areas; embedded floor plan is raster"))
    total = sum(len(f["units"]) for f in inventory["floors"])
    inventory["unit_count_listed"] = total
    write_json(INVENTORY, inventory)
    print(f"floors={len(inventory['floors'])} units_listed={total} downloads={len(inventory['downloads'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
