"""Offline acceptance checks on the actual source, compiled JSON and SVG files."""
import hashlib
import itertools
import json
import re
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

import fitz
import numpy as np
from PIL import Image
from shapely.geometry import Polygon, box

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/"assets/source/mocire-zadar-h"
read=lambda path: json.loads(path.read_text())
sha=lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
m=read(SRC/"stage2-manifest.json")
original=read(SRC/"inventory.json")
floors=read(ROOT/"src/data/floors.json")["floors"]
units=read(ROOT/"src/data/apartments.json")["units"]
by_unit={u["unit_id"]:u for u in units}
assert len(by_unit)==len(units)
assets={r["source_url"]:r for r in m["assets"]}
assert len(assets)==len(m["assets"]) and not m["errors"]
webp=0
for a in assets.values():
    p=SRC/a["path"]
    assert sha(p)==a["sha256"] and p.stat().st_size==a["bytes"],p
    assert a["referrer"] in m["pages"] and a["rights"] in m["rights"],a
    if "optimized" not in a: continue
    d=a["optimized"]
    q=SRC/d["path"]
    assert sha(q)==d["sha256"] and q.stat().st_size==d["bytes"],q
    with Image.open(q) as b,Image.open(p) as orig:
        assert b.format=="WEBP" and b.size==(d["width"],d["height"])
        assert orig.size==(a["width"],a["height"])
        if a["kind"]!="exterior":
            b1=np.array(orig.convert("RGBA")); b2=np.array(b.convert("RGBA"))
            assert np.array_equal(b1[:,:,3],b2[:,:,3]) and np.array_equal(b1[b1[:,:,3]>0],b2[b2[:,:,3]>0]),q
    webp+=1
print("Originals:",dict(Counter(a["kind"] for a in assets.values())),"; verified WebPs:",webp)

old={u["label"]:(f["level"],u) for f in original["floors"] for u in f["units"]}
live={u["naziv"]:(f["level"],u) for f in m["floor_snapshots"] for u in f["rows"]}
assert old.keys()==live.keys()==by_unit.keys()
conflicts=[]
for uid,u in by_unit.items():
    level,o=old[uid]
    l,v=live[uid]
    assert l==level==u["floor_id"]
    assert uid in next(f for f in floors if f["floor_id"]==l)["unit_ids"]
    assert (u["source_ref"],u["listing_area_raw"],u["unit_type_source_label"],u["property_type"],u["status"])==(
        v["link"],v["povrsina"],v["sobnost"],v["tip_nekretnine"],v["status"])==(
        o["detail_url"],o["gross_area_raw"],o["rooms_label"],o["property_type"],o["status_raw"])
    detail=m["pages"][u["source_ref"]]
    assert u["detail_page"]["facts"]==detail["detail_facts"]
    printed_level={"L00":"Prizemlje","L01":"Prvi","L02":"Drugi","L03":"Treći","L04":"Četvrti"}[level]
    assert detail["detail_facts"]["Kat"]==printed_level
    for code in ["NP","NKP"]:
        field=code.lower()+"_total_m2"
        raw=detail["detail_totals_raw"].get(f"Sveukupno {code} stana")
        expected=float(raw.replace(",",".")) if raw is not None else None
        assert u["detail_page"][field]==expected
        assert (f"DETAIL_AND_SHEET_{code}_DIFFER" in u["flags"])==(expected is not None and expected!=u["sheet"][field])
    for key,kind in [("sheet","sheet"),("unit_drawing","unit-plan")]:
        asset=assets[u[key]["source_url"]]
        assert (asset["kind"],asset["unit_id"],asset["sha256"],asset["referrer"])==(kind,uid,u[key]["sha256"],v["link"])
    with fitz.open(SRC/assets[u["sheet"]["source_url"]]["path"]) as doc:
        words=doc[0].get_text("words")
        assert len(doc)==1 and set(re.findall(r"\bH \d+\.\d+\b",doc[0].get_text()))=={uid}
        # Independent of the dataset parser's text order. Read the last
        # amount in each physically printed PDF table column.
        for lo,hi,field in [(470,515,"np_total_m2"),(530,558,"nkp_total_m2")]:
            w=max((w for w in words if lo<w[0]<hi and re.fullmatch(r"\d+,\d{2}",w[4])),key=lambda w:w[1])
            assert float(w[4].replace(",","."))==u["sheet"][field],uid
    if u["listing_area_m2"]!=u["sheet"]["nkp_total_m2"]:
        assert "LISTING_AND_SHEET_NKP_DIFFER" in u["flags"]
        conflicts.append(uid)
np_conflicts=sum("DETAIL_AND_SHEET_NP_DIFFER" in u["flags"] for u in units)
print(f"Verified {len(units)} listing/detail/PDF joins; area discrepancies: {len(conflicts)} NKP, {np_conflicts} NP.")
mapped=0
for f in floors:
    expected={u["unit_id"] for u in units if u["floor_id"]==f["floor_id"]}
    assert list(dict.fromkeys(f["unit_ids"]))==f["unit_ids"] and set(f["unit_ids"])==expected
    for plan in f["plans"]:
        p=ROOT/plan["private_overlay"]
        svg=ET.parse(p).getroot()
        a=assets[plan["source_url"]]
        assert a["kind"]=="plan" and a["referrer"]==f["source_url"]
        assert svg.get("data-level")==f["floor_id"] and svg.get("data-plan-sha256")==a["sha256"]==plan["sha256"]
        assert svg.get("viewBox")==plan["viewBox"]==f"0 0 {a['width']} {a['height']}"
        assert sha(p)==plan["overlay_sha256"] and sha(ROOT/plan["private_plan"])==a["optimized"]["sha256"]==plan["optimized_sha256"]
        canvas=box(0,0,a["width"],a["height"])
        shapes={}
        for e in svg.findall("{http://www.w3.org/2000/svg}polygon"):
            uid=e.get("data-unit-id")
            assert uid not in shapes
            shape=Polygon([tuple(map(float,p.split(","))) for p in e.get("points").split()])
            assert shape.is_valid and shape.area>0 and canvas.covers(shape),(p,uid)
            shapes[uid]=shape
        assert set(shapes)==expected and len(shapes)==plan["registered_units"]
        assert all(a.intersection(b).area<1e-6 for a,b in itertools.combinations(shapes.values(),2)),p
        mapped+=len(shapes)
print(f"{len(floors)} floors; {mapped} polygons; zero missing, wrong-floor, duplicate, degenerate, overlapping or out-of-bounds shapes.")
for name in ("floorplans","overlays"):
    assert {p.name for p in (ROOT/"public"/name).iterdir()}=={".gitkeep"}
print("Public Stage 2 asset files: 0")
