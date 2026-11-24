#!/usr/bin/env python3
"""Extract vector paths, text lines and image blocks per PDF page into raw JSON.

Coordinates are PyMuPDF PDF points with the origin at the top-left of the page (y grows downward).
Usage: extract_vectors.py <pdf> <out_dir>
"""
from __future__ import annotations

import sys
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).parent))
from pdfgeo import write_json  # noqa: E402


def _pt(p) -> list[float]:
    return [float(p.x), float(p.y)]


def extract_page(page: fitz.Page) -> dict:
    paths = []
    for d in page.get_drawings():
        items = []
        for it in d["items"]:
            kind = it[0]
            if kind == "l":
                items.append({"k": "l", "p": [_pt(it[1]), _pt(it[2])]})
            elif kind == "re":
                r = it[1]
                items.append({"k": "re", "bbox": [r.x0, r.y0, r.x1, r.y1]})
            elif kind == "qu":
                q = it[1]
                items.append({"k": "qu", "pts": [_pt(q.ul), _pt(q.ur), _pt(q.lr), _pt(q.ll)]})
            elif kind == "c":
                items.append({"k": "c", "pts": [_pt(p) for p in it[1:5]]})
        paths.append({
            "fill": list(d["fill"]) if d.get("fill") is not None else None,
            "color": list(d["color"]) if d.get("color") is not None else None,
            "width": d.get("width"),
            "bbox": list(d["rect"]),
            "items": items,
        })

    texts = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text:
                continue
            texts.append({
                "text": text,
                "bbox": list(line["bbox"]),
                "dir": list(line["dir"]),
                "size": max(span["size"] for span in line["spans"]),
            })

    images = [{"bbox": list(info["bbox"])} for info in page.get_image_info()]
    return {
        "width_pt": page.rect.width,
        "height_pt": page.rect.height,
        "rotation": page.rotation,
        "coordinate_space": "PyMuPDF points, origin top-left, y down",
        "paths": paths,
        "texts": texts,
        "images": images,
    }


def extract(pdf: Path, out_dir: Path) -> dict:
    doc = fitz.open(pdf)
    out_dir = Path(out_dir)
    index = {"source_pdf": str(pdf), "page_count": len(doc), "pages": []}
    for i, page in enumerate(doc, start=1):
        data = extract_page(page)
        data["page"] = i
        name = f"page-{i:03d}.json"
        write_json(out_dir / name, data)
        index["pages"].append({"page": i, "file": name, "paths": len(data["paths"]),
                               "texts": len(data["texts"]), "images": len(data["images"])})
    write_json(out_dir / "index.json", index)
    return index


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    index = extract(Path(argv[0]), Path(argv[1]))
    print(f"extracted {index['page_count']} page(s) to {argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
