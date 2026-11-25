"""Fetch free CC0 pre-made 3D tree, shrub, and car models for Močire Zadar H.

Downloads into assets/blender/cc0/ and writes provenance.json.
Sources:
  - Poly Haven public API (CC0 1.0 Public Domain): realistic 3D trees & shrubs (glTF/GLB)
  - Khronos glTF-Sample-Assets & Poly Pizza / Quaternius (CC0): modern car GLBs
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "assets/blender/cc0")
os.makedirs(OUT_DIR, exist_ok=True)


def fetch_json(url):
    out = subprocess.check_output(
        ["curl", "-fsSL", "-A", "MocireArchViz/1.0", url],
        timeout=30,
    )
    return json.loads(out.decode("utf-8"))


def download_file(url, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.check_call(
        ["curl", "-fsSL", "-A", "MocireArchViz/1.0", "-o", dst, url],
        timeout=60,
    )
    return os.path.getsize(dst)


def fetch_polyhaven_models():
    assets = fetch_json("https://api.polyhaven.com/assets?t=models")
    # Pick realistic outdoor trees & shrubs available on Poly Haven
    preferred = [
        "jacaranda_tree",
        "tree_small_02",
        "shrub_01",
        "shrub_02",
        "shrub_03",
        "shrub_04",
        "potted_plant_01",
        "pine_tree_01",
        "fir_tree_01",
        "island_tree_01",
        "island_tree_02",
        "cherry_blossom_tree",
        "dead_tree_trunk",
    ]
    found = [k for k in preferred if k in assets]
    # Also discover any other tree/shrub/plant models dynamically
    for k, meta in assets.items():
        cats = " ".join(meta.get("categories", [])).lower()
        tags = " ".join(meta.get("tags", [])).lower()
        if any(w in cats or w in tags for w in ("tree", "shrub", "bush", "foliage")) and k not in found:
            if "dead" not in k and "stump" not in k and "log" not in k:
                found.append(k)
    print("Poly Haven vegetation candidates:", found[:12])

    downloaded = []
    for asset_id in found:
        if len(downloaded) >= 3:
            break
        try:
            files = fetch_json(f"https://api.polyhaven.com/files/{asset_id}")
            gltf_sec = files.get("gltf", {})
            # Pick 1k resolution for fast web performance
            res_key = "1k" if "1k" in gltf_sec else (next(iter(gltf_sec.keys()), None))
            if not res_key:
                continue
            entry = gltf_sec[res_key].get("gltf")
            if not entry:
                continue
            sub = os.path.join(OUT_DIR, "trees", asset_id)
            main_url = entry["url"]
            main_name = os.path.basename(main_url)
            main_dst = os.path.join(sub, main_name)
            total_bytes = download_file(main_url, main_dst)
            for rel_path, inc in (entry.get("include") or {}).items():
                inc_dst = os.path.join(sub, rel_path)
                total_bytes += download_file(inc["url"], inc_dst)
            downloaded.append({
                "id": asset_id,
                "kind": "tree",
                "license": "CC0-1.0",
                "source": f"https://polyhaven.com/a/{asset_id}",
                "path": os.path.relpath(main_dst, ROOT),
                "bytes": total_bytes,
            })
            print(f"  OK tree {asset_id} ({res_key}): {total_bytes / 1024:.1f} KB")
        except Exception as e:
            print(f"  SKIP tree {asset_id}: {e}")
    return downloaded


def fetch_cc0_cars():
    candidates = [
        (
            "car_sedan_quaternius",
            "https://static.poly.pizza/755c91ff-ea60-496a-b28f-aa7e91409f6e.glb",
            "https://poly.pizza/bundle/13",
        ),
        (
            "car_sports_quaternius",
            "https://static.poly.pizza/18413b53-41bb-4f46-814d-176f18391696.glb",
            "https://poly.pizza/bundle/13",
        ),
        (
            "car_concept_khronos",
            "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb",
            "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept",
        ),
    ]
    downloaded = []
    for cid, url, page in candidates:
        try:
            dst = os.path.join(OUT_DIR, "cars", f"{cid}.glb")
            nbytes = download_file(url, dst)
            downloaded.append({
                "id": cid,
                "kind": "car",
                "license": "CC0-1.0",
                "source": page,
                "url": url,
                "path": os.path.relpath(dst, ROOT),
                "bytes": nbytes,
            })
            print(f"  OK car {cid}: {nbytes / 1024:.1f} KB")
        except Exception as e:
            print(f"  SKIP car {cid}: {e}")
    return downloaded


def main():
    trees = fetch_polyhaven_models()
    cars = fetch_cc0_cars()
    prov = {
        "schema": "mocire-h.cc0-assets/1",
        "trees": trees,
        "cars": cars,
    }
    with open(os.path.join(OUT_DIR, "provenance.json"), "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2)
    print(f"FETCH_DONE: {len(trees)} trees, {len(cars)} cars")


if __name__ == "__main__":
    main()
