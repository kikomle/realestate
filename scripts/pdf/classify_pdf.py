#!/usr/bin/env python3
"""Classify each page as VECTOR, RASTER or MIXED and emit JSON.

Rules (fraction = image-block area clipped to the page / page area):
- VECTOR: >= 1 vector path group and image fraction < 0.2
- MIXED:  >= 1 vector path group and image fraction >= 0.2
- RASTER: no vector path groups and image fraction >= 0.5 (scanned or photographed drawing)
- TEXT_ONLY: no vector path groups, image fraction < 0.5, and text words present
- EMPTY: nothing extractable
A VECTOR/MIXED page with zero extractable words is reported with reason NO_TEXT.
Image files (.png/.jpg) are always RASTER.

Usage: classify_pdf.py <pdf-or-image> <out.json>
"""
from __future__ import annotations

import sys
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).parent))
from pdfgeo import write_json  # noqa: E402

PATH_THRESHOLD = 1  # PyMuPDF groups drawing ops; a minimal plan can have only 2 path groups


def classify_page(page: fitz.Page) -> dict:
    paths = page.get_drawings()
    n_paths = len(paths)
    n_items = sum(len(p["items"]) for p in paths)
    words = page.get_text("words")
    images = page.get_image_info()
    page_rect = page.rect
    page_area = page_rect.width * page_rect.height
    img_area = 0.0
    for info in images:
        clipped = fitz.Rect(info["bbox"]) & page_rect
        img_area += clipped.get_area()
    img_fraction = min(1.0, img_area / page_area) if page_area else 0.0

    reasons = []
    if n_paths >= PATH_THRESHOLD and img_fraction < 0.2:
        cls = "VECTOR"
    elif n_paths >= PATH_THRESHOLD:
        cls = "MIXED"
        reasons.append("vector paths present alongside image blocks")
    elif img_fraction >= 0.5:
        cls = "RASTER"
        reasons.append("image blocks dominate; few vector paths")
    elif words:
        cls = "TEXT_ONLY"
    else:
        cls = "EMPTY"
    if cls in ("VECTOR", "MIXED") and not words:
        reasons.append("NO_TEXT: no extractable text words")
    if cls == "MIXED" and img_fraction >= 0.5:
        reasons.append("image blocks cover most of the page; geometry may be a raster tile")

    return {
        "class": cls,
        "vector_paths": n_paths,
        "vector_items": n_items,
        "text_words": len(words),
        "image_blocks": len(images),
        "image_coverage": round(img_fraction, 4),
        "reasons": reasons,
    }


def classify(source: Path) -> dict:
    source = Path(source)
    if source.suffix.lower() in (".png", ".jpg", ".jpeg"):
        pix = fitz.Pixmap(str(source))
        return {
            "source": str(source),
            "page_count": 1,
            "pages": [{"page": 1, "class": "RASTER", "vector_paths": 0, "vector_items": 0,
                       "text_words": None, "image_blocks": 1, "image_coverage": 1.0,
                       "pixel_size": [pix.width, pix.height],
                       "reasons": ["image file: no vector content available"]}],
        }
    doc = fitz.open(source)
    pages = []
    for i, page in enumerate(doc, start=1):
        info = classify_page(page)
        info["page"] = i
        pages.append(info)
    return {"source": str(source), "page_count": len(doc), "pages": pages}


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    result = classify(Path(argv[0]))
    write_json(Path(argv[1]), result)
    summary = {}
    for p in result["pages"]:
        summary[p["class"]] = summary.get(p["class"], 0) + 1
    print(f"{result['page_count']} page(s); classes: {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
