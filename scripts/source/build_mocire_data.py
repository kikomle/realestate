"""Compile the Stage 2 fact datasets; never infer measures from SVG pixels."""
import hashlib
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

import fitz

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT/"assets/source/mocire-zadar-h"
PRIVATE = ROOT/"assets/geometry/stage2/private"
OUT = ROOT/"src/data"
MANIFEST = SOURCE/"stage2-manifest.json"
AREA = r"(\d+(?:,\d+)?)\s*m²"
ROOM = re.compile(r"(?:^|\n)(\d+[a-z]?)\s+([^\n\d][^²]*?)\s+" + AREA +
                  r"\s+(\d+(?:,\d+)?)\s+" + AREA,re.M)


def num(value):
    return float(value.replace(",","."))


def schedule(record, uid, floor_title):
    with fitz.open(SOURCE/record["path"]) as doc:
        text=doc[0].get_text()
    if set(re.findall(r"\bH \d+\.\d+\b",text))!={uid} or floor_title not in text.splitlines():
        raise ValueError(f"Sheet identity mismatch: {uid}")
    table=text.split(f"NP\nK\nNKP\n{uid}\n")[1]
    values=re.findall(AREA,table)
    rooms=[{"number":n,"label":" ".join(label.split()),"np_m2":num(np),
            "coefficient":num(k),"nkp_m2":num(nkp)}
           for n,label,np,k,nkp in ROOM.findall(table)]
    # In these one-page schedules there are two subtotals and one grand
    # total, each with NP and NKP; verify coverage rather than dropping rows.
    if len(rooms)*2+6!=len(values) or len({r["number"] for r in rooms})!=len(rooms):
        raise ValueError(f"Unsupported room schedule: {uid}")
    return {"page":1,"np_total_m2":num(values[-2]),"nkp_total_m2":num(values[-1]),"rooms":rooms}


def source(record):
    return {k:record[k] for k in ["source_url","sha256","original_name"]}


def main():
    m=json.loads(MANIFEST.read_text())
    sheets={r["unit_id"]:r for r in m["assets"] if r["kind"]=="sheet"}
    details={r["unit_id"]:r for r in m["assets"] if r["kind"]=="unit-plan"}
    floors=[]
    units=[]
    for group in m["floor_snapshots"]:
        level=group["level"]
        ids=[u["naziv"] for u in group["rows"]]
        plans=[]
        for art in (r for r in m["assets"] if r["kind"]=="plan" and r["referrer"]==group["page_url"]):
            variant="gallery" if "galerije" in art["original_name"].lower() else "main"
            key=level if variant=="main" else f"{level}-{variant}"
            overlay=PRIVATE/"overlays"/f"{key}.svg"
            svg=ET.parse(overlay).getroot()
            assert svg.get("data-plan-sha256")==art["sha256"]
            mapped=[e.get("data-unit-id") for e in svg if e.get("data-unit-id")]
            assert len(mapped)==len(ids) and set(mapped)==set(ids)
            plans.append({"image_id":key,"variant":variant,**source(art),"width_px":art["width"],"height_px":art["height"],
                          "viewBox":svg.attrib["viewBox"],"registered_units":len(mapped),
                          "private_plan":str((SOURCE/art["optimized"]["path"]).relative_to(ROOT)),
                          "optimized_sha256":art["optimized"]["sha256"],"private_overlay":str(overlay.relative_to(ROOT)),
                          "overlay_sha256":hashlib.sha256(overlay.read_bytes()).hexdigest(),"release_url":None})
        assert plans and sum(p["variant"]=="main" for p in plans)==1
        floors.append({"floor_id":level,"label":group["label"],"source_url":group["page_url"],
                       "as_of":m["pages"][group["page_url"]]["retrieved_at"],"unit_ids":ids,"plans":plans,
                       "metric_scale":None,"flags":["METRIC_SCALE:MISSING_SOURCE","PUBLIC_ART_AND_OVERLAYS:NOT_CLEARED"]})
        for u in group["rows"]:
            uid=u["naziv"]
            sheet=sheets[uid]
            drawn=schedule(sheet,uid,"PRIZEMLJE" if level=="L00" else f"{int(level[1:])}. KAT")
            detail=m["pages"][u["link"]]
            facts=detail["detail_facts"]
            totals=detail["detail_totals_raw"]
            web_np=totals.get("Sveukupno NP stana")
            web_nkp=totals.get("Sveukupno NKP stana")
            flags=["PRICE:MISSING_SOURCE","ORIENTATION:UNKNOWN","INTERIOR_NET_AREA:UNKNOWN"]
            if drawn["nkp_total_m2"]!=num(u["povrsina"]):
                flags.append("LISTING_AND_SHEET_NKP_DIFFER")
            for key,raw in [("NP",web_np),("NKP",web_nkp)]:
                if raw is None:
                    flags.append(f"DETAIL_{key}:MISSING_SOURCE")
                elif num(raw)!=drawn[key.lower()+"_total_m2"]:
                    flags.append(f"DETAIL_AND_SHEET_{key}_DIFFER")
            for name,expected in [("Status",u["status"]),("Sobnost",u["sobnost"]),("Tip nekretnine",u["tip_nekretnine"])]:
                if facts.get(name)!=expected: flags.append(f"DETAIL_FACT_REVIEW:{name}")
            units.append({"unit_id":uid,"floor_id":level,"source_ref":u["link"],"property_type":u["tip_nekretnine"],
                          "unit_type_source_label":u["sobnost"],"status":u["status"],"status_as_of":floors[-1]["as_of"],
                          "listing_area_raw":u["povrsina"],"listing_area_m2":num(u["povrsina"]),
                          "net_interior_area_m2":None,"orientation":None,"price":None,"flags":flags,
                          "detail_page":{"retrieved_at":detail["retrieved_at"],"facts":facts,
                                         "np_total_m2":num(web_np) if web_np is not None else None,
                                         "nkp_total_m2":num(web_nkp) if web_nkp is not None else None},
                          "unit_drawing":source(details[uid]),"sheet":{**source(sheet),**drawn}})
    common={"project":"Močire Zadar H","building":"B01","source_manifest":str(MANIFEST.relative_to(ROOT))}
    data={"floors":{**common,"coordinate_system":"Native drawing pixels; x right, y down; no crop.","floors":floors},
          "apartments":{**common,"listing_area_label":"Obračunska površina",
                        "sheet_convention":"NP and NKP are the printed schedule columns; totals include the listed exterior spaces. K is the printed coefficient. None is inferred from a polygon.",
                        "units":units}}
    OUT.mkdir(parents=True,exist_ok=True)
    for name,doc in data.items():
        (OUT/f"{name}.json").write_text(json.dumps(doc,indent=2,ensure_ascii=False)+"\n")
    conflicts=[u["unit_id"] for u in units if "LISTING_AND_SHEET_NKP_DIFFER" in u["flags"]]
    print(f"floors={len(floors)} units={len(units)} room_schedule_rows={sum(len(u['sheet']['rooms']) for u in units)}")
    print(f"listing/sheet NKP conflicts ({len(conflicts)}): {', '.join(conflicts)}")


if __name__=="__main__": main()
