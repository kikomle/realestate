"""Snapshot the assets actually linked from the H pages. Run with .venv/bin/python.

Original URLs (including version suffixes) come from the pages. Original bytes
are immutable; a changed resource on a later run gets its own hash-suffixed file.
"""
import argparse
import hashlib
import html
import io
import json
import re
import ssl
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

import certifi
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/source/mocire-zadar-h"
RAW = SOURCE / "raw"
INTAKE = RAW / "stage2"
INV = json.loads((SOURCE / "inventory.json").read_text())
PROJECT = INV["source_page"]
UA = "MocireLocalDemo/1.0"
SHA = lambda b: hashlib.sha256(b).hexdigest()
now = lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
context = ssl.create_default_context(cafile=certifi.where())
robot = RobotFileParser()
last = 0.
resume = False


def write(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(p)


def get(url, check=True):
    global last
    if urlsplit(url).netloc != "www.sigma.hr" or check and not robot.can_fetch(UA, url):
        raise ValueError("URL outside the accessible H source: " + url)
    time.sleep(max(0., 1. - (time.monotonic() - last)))
    last = time.monotonic()
    with urlopen(Request(url, headers={"User-Agent": UA}), context=context, timeout=40) as r:
        return r.read(), dict(retrieved_at=now(), last_modified=r.headers.get("Last-Modified"),
                              content_type=r.headers.get_content_type(), resolved_url=r.url)


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag in {"a", "img", "meta"}:
            self.tags.append((tag, dict(attrs)))


assets, errors, pages, floors = [], [], {}, []


def page(url):
    data, receipt = get(url)
    text = data.decode()
    graph = re.search(r'<script[^>]*class="yoast-schema-graph"[^>]*>(.*?)</script>', text, re.S)
    meta = next((e for e in json.loads(graph[1])["@graph"] if e.get("@type") == "WebPage"), {}) if graph else {}
    pages[url] = {**receipt, "sha256": SHA(data), "published": meta.get("datePublished"), "modified": meta.get("dateModified")}
    return text, Links(text).tags


def detail_facts(text):
    # Agent A's detail-page extraction. Keep the HTML and PDF totals as
    # separate source records; the publisher's two versions can differ.
    def clean(fragment):
        return " ".join(html.unescape(re.sub("<[^>]+>", " ", fragment)).split())
    facts={clean(k):clean(v) for k,v in re.findall(
        r"<li>([^<:]+):\s*<span[^>]*>(.*?)</span>\s*</li>",text,re.S)}
    totals={clean(k):clean(v) for k,v in re.findall(
        r'<h3 class="total-title">\s*([^<]+):\s*<span>(.*?)</span>\s*</h3>',text,re.S)}
    return {"detail_facts":facts,"detail_totals_raw":totals}


def asset(kind, url, ref, unit=None, existing=None):
    url = urljoin(ref, url)
    uid = unit["label"] if unit else None
    name = unquote(Path(urlsplit(url).path).name)
    cache = INTAKE / "receipts" / (SHA(url.encode()) + ".json")
    if resume and cache.exists():
        old = json.loads(cache.read_text())
        files=[(SOURCE/old["path"],old["sha256"])]
        if "optimized" in old:
            web=old["optimized"]
            files.append((SOURCE/web["path"],web["sha256"]))
        if old["referrer"] == ref and old["unit_id"] == uid and all(p.is_file() and SHA(p.read_bytes())==h for p,h in files):
            assets.append(old)
            return
    b, r = get(url)
    h = SHA(b)
    p = INTAKE / kind / name
    if existing and existing.is_file() and SHA(existing.read_bytes()) == h:
        p = existing
    elif p.exists() and SHA(p.read_bytes()) != h:
        p = p.with_name(f"{p.stem}-{h[:16]}{p.suffix}")
    a = {"kind": kind, "unit_id": uid, "source_url": url, "original_name": name,
         "referrer": ref, **r, "sha256": h, "bytes": len(b), "path": str(p.relative_to(SOURCE)),
         "rights": "sigma-private-demo"}
    if kind == "sheet":
        with fitz.open(stream=b, filetype="pdf") as doc:
            text = "\n".join(pg.get_text() for pg in doc)
            labels = sorted(set(re.findall(r"(?<!\w)H\s+(\d\.\d+)(?!\d)", text)))
            if labels != [uid[2:]]:
                a["identity_warning"] = labels
            a.update(pages=len(doc), pdf_created=doc.metadata.get("creationDate"), pdf_modified=doc.metadata.get("modDate"))
    else:
        im = Image.open(io.BytesIO(b))
        im.load()
        a.update(width=im.width, height=im.height, format=im.format)
        web = INTAKE / "webp" / (p.stem + "-" + h[:12] + ".webp")
        web.parent.mkdir(parents=True, exist_ok=True)
        raster = im.convert("RGBA" if im.mode == "RGBA" or "transparency" in im.info else "RGB")
        if kind == "exterior":
            raster.thumbnail((1920,1920),Image.Resampling.LANCZOS)
        raster.save(web, method=6, lossless=kind != "exterior", quality=82, exact=True)
        a["optimized"] = dict(path=str(web.relative_to(SOURCE)), width=raster.width, height=raster.height,
                              bytes=web.stat().st_size, sha256=SHA(web.read_bytes()),
                              profile="webp-q82-long-edge-1920-no-crop" if kind == "exterior" else "lossless-webp-native-no-crop")
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        p.write_bytes(b)
    write(cache, a)
    assets.append(a)


def capture(kind, url, ref, **kwargs):
    try:
        asset(kind, url, ref, **kwargs)
    except Exception as error:
        errors.append({"kind": kind, "url": url, "referrer": ref, "error": str(error)})


def main():
    global resume
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resume",action="store_true",help="reuse verified asset receipts from an interrupted collection")
    resume=parser.parse_args().resume
    rules, receipt = get("https://www.sigma.hr/robots.txt", check=False)
    robot.parse(rules.decode().splitlines())
    _, tags = page(PROJECT)
    mounts = {f["page_url"] for f in INV["floors"]}
    assert mounts <= {urljoin(PROJECT, a.get("href") or "") for tag,a in tags if tag == "a"}
    for url in sorted({a["href"] for tag,a in tags if tag == "a" and re.search(r'/Mocire_H-Zadar_\d+\.jpg$',a.get("href") or "",re.I)}):
        capture("exterior", url, PROJECT)
    for f in INV["floors"]:
        ref = f["page_url"]
        text, tags = page(ref)
        rows = json.loads(re.search(r"\$scope\.data = (\[[\s\S]*?\]);", text)[1])
        floors.append({"level": f["level"], "label": f["floor_label"], "page_url": ref, "rows": rows})
        for t, a in tags:
            if t != "img" or not a.get("usemap") or not a.get("src"):
                continue
            existing = next((RAW / d["file"] for d in INV["downloads"] if d["source_url"] == a["src"]), None)
            capture("plan", a["src"], ref, existing=existing)
    for f in floors:
        for row in f["rows"]:
            ref, uid = row["link"], row["naziv"]
            try:
                text, tags = page(ref)
                pages[ref].update(detail_facts(text))
                sheets = sorted({a["href"] for t,a in tags if t=="a" and (a.get("href") or "").lower().endswith(".pdf")})
                drawings = sorted({a["src"] for t,a in tags if t=="img" and a.get("alt","").strip()==uid and a.get("src")})
                if not sheets or not drawings:
                    errors.append({"unit_id":uid,"referrer":ref,"pdfs":len(sheets),"previews":len(drawings)})
                for url in sheets:
                    capture("sheet",url,ref,unit={"label":uid},existing=RAW / f"apartment-H-{uid[2:]}.pdf")
                for url in drawings:
                    capture("unit-plan",url,ref,unit={"label":uid})
            except Exception as error:
                errors.append({"unit_id":uid,"referrer":ref,"error":str(error)})
        print(f'{f["level"]} complete',flush=True)
    manifest = {"building":"Močire Zadar H","project":PROJECT,"completed_at":now(),
                "rights":{"sigma-private-demo":{"notice":"SIGMA © 2023 - 2026. Sva prava pridržana.",
                  "art":"User-authorized local demo/inspection only; owner grant for redistribution not documented.",
                  "registration":"Independently produced private study only; no grant to reuse Sigma coordinates or release overlays.",
                  "publication":"NOT_CLEARED","notice_page":PROJECT}},
                "robots":{"url":"https://www.sigma.hr/robots.txt","text":rules.decode(),**receipt},
                "pages":pages,"floor_snapshots":floors,"assets":assets,"errors":errors}
    destination=SOURCE/"stage2-manifest.json"
    if destination.exists():
        previous=destination.read_bytes()
        archived=INTAKE/"snapshots"/(SHA(previous)+".json")
        archived.parent.mkdir(parents=True,exist_ok=True)
        if not archived.exists(): archived.write_bytes(previous)
    write(destination,manifest)
    from collections import Counter
    print(Counter(a["kind"] for a in assets), "errors",errors)
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main())
