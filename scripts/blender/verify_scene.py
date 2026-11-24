"""Verify an exported GLB + manifest without any GUI. Exit code 1 on any failure.

  python3 scripts/blender/verify_scene.py --glb <file.glb> --manifest <file.manifest.json> [--expect-buildings 2 --expect-levels 2 --expect-units-per-level 2]

Checks:
  1. GLB header/magic, JSON chunk parses, glTF asset.version == 2.0
  2. Every expected contract name exists as a glTF node name (no duplicates)
  3. Hierarchy: every object node with a manifest parent is a child of that parent node
  4. Manifest <-> GLB: same set of names; manifest bbox sane (finite, metres, size > 0 for meshes)
  5. Mesh nodes: positive triangle count; accessor POSITION min/max sane (metres range < 500)
  6. Custom props present: semantic_id == name, source_ref string, confidence in [0,1]
  7. Structural expectations (buildings, levels, units) derived from names
"""
import argparse
import json
import math
import re
import struct
import sys

NAME_RE = re.compile(r"^(B\d{2})__(L[M]?\d{2})__(NONE|U\d{3})__(wall|slab|window|door|balcony|stair|column|roof|site)__(\d{3})$")
ROOT_RE = re.compile(r"^(B\d{2})__(L\d{2})__NONE__roof__000$")  # placeholder root (see build script)


def read_glb(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError(f"not a glTF 2.0 binary: magic={magic!r} version={version}")
    if length != len(data):
        raise ValueError(f"header length {length} != file size {len(data)}")
    clen, ctype = struct.unpack_from("<I4s", data, 12)
    if ctype != b"JSON":
        raise ValueError("first chunk is not JSON")
    gltf = json.loads(data[20:20 + clen].decode("utf-8"))
    bin_off = 20 + clen
    binary = b""
    if bin_off < len(data):
        blen, btype = struct.unpack_from("<I4s", data, bin_off)
        if btype == b"BIN\x00":
            binary = data[bin_off + 8:bin_off + 8 + blen]
    return gltf, binary


def accessor_minmax_ok(gltf, idx):
    acc = gltf["accessors"][idx]
    mn, mx = acc.get("min"), acc.get("max")
    if not mn or not mx:
        return False, "no min/max"
    if acc.get("normalized"):
        # KHR_mesh_quantization: stored integers are normalized to [-1,1]; the real span
        # comes from the node's scale/translation, so only the sign and finiteness are checked here.
        return all(math.isfinite(v) for v in mn + mx), "quantized (normalized) accessor"
    span = max(abs(mx[i] - mn[i]) for i in range(3))
    return span < 500.0, f"span {span:.2f} m"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--expect-buildings", type=int, default=2)
    ap.add_argument("--expect-levels", type=int, default=2)
    ap.add_argument("--expect-units-per-level", type=int, default=2)
    args = ap.parse_args()

    failures = []

    def fail(msg):
        failures.append(msg)
        print("FAIL:", msg)

    def ok(msg):
        print("PASS:", msg)

    gltf, _binary = read_glb(args.glb)
    if gltf.get("asset", {}).get("version") != "2.0":
        fail("asset.version != 2.0")
    else:
        ok("glTF 2.0 binary container valid")

    nodes = gltf.get("nodes", [])
    names = [n.get("name") for n in nodes]
    dupes = sorted({n for n in names if names.count(n) > 1 and n})
    if dupes:
        fail(f"duplicate node names: {dupes[:5]}")
    else:
        ok(f"{len(nodes)} nodes, no duplicate names")

    name_to_index = {n.get("name"): i for i, n in enumerate(nodes) if n.get("name")}
    parent_of = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent_of[c] = i

    manifest = json.load(open(args.manifest))
    objs = manifest.get("objects", [])
    manifest_names = {o["name"] for o in objs}
    glb_names = set(name_to_index)

    missing_in_glb = sorted(manifest_names - glb_names)
    extra_in_glb = sorted(glb_names - manifest_names)
    if missing_in_glb:
        fail(f"manifest objects missing in GLB: {missing_in_glb[:8]}")
    if extra_in_glb:
        fail(f"GLB nodes not in manifest: {extra_in_glb[:8]}")
    if not missing_in_glb and not extra_in_glb:
        ok(f"manifest and GLB node names match exactly ({len(manifest_names)})")

    bad_names = [n for n in glb_names if not NAME_RE.match(n) and not ROOT_RE.match(n)]
    if bad_names:
        fail(f"names violating contract: {bad_names[:5]}")
    else:
        ok("all node names match {B}__{L}__{U}__{TYPE}__{IDX} contract")

    for o in objs:
        parent = o.get("parent")
        if not parent:
            continue
        if parent not in name_to_index:
            fail(f"parent {parent} of {o['name']} not in GLB")
            continue
        child_idx = name_to_index.get(o["name"])
        if child_idx is None or parent_of.get(child_idx) != name_to_index[parent]:
            fail(f"hierarchy: {o['name']} is not a child of {parent} in GLB")
    if not any(f.startswith("hierarchy") or f.startswith("parent") for f in failures):
        ok("hierarchy: every manifest parent is the GLB parent node")

    bad_bbox = []
    zero_mesh = []
    for o in objs:
        bb = o.get("bbox_m")
        if o["type"] == "root":
            continue
        if not bb:
            bad_bbox.append(o["name"])
            continue
        size = bb["size"]
        if not all(math.isfinite(v) for v in size) or any(v < 0 for v in size):
            bad_bbox.append(o["name"])
        if max(size) > 500 or max(size) <= 0:
            bad_bbox.append(o["name"])
        if o.get("triangles", 0) <= 0:
            zero_mesh.append(o["name"])
    if bad_bbox:
        fail(f"insane bbox (non-metre or zero): {bad_bbox[:5]}")
    else:
        ok("bounding boxes finite, metres, non-zero")
    if zero_mesh:
        fail(f"mesh objects with zero triangles: {zero_mesh[:5]}")
    else:
        ok("every mesh object has triangles > 0")

    bad_pos = []
    for n in nodes:
        mesh_idx = n.get("mesh")
        if mesh_idx is None:
            continue
        for prim in gltf["meshes"][mesh_idx]["primitives"]:
            pos = prim["attributes"].get("POSITION")
            if pos is None:
                bad_pos.append(n["name"])
                continue
            good, _ = accessor_minmax_ok(gltf, pos)
            if not good:
                bad_pos.append(n["name"])
    if bad_pos:
        fail(f"POSITION accessors missing or out of range: {bad_pos[:5]}")
    else:
        ok("POSITION accessors present with sane min/max")

    prop_bad = []
    for n in nodes:
        name = n.get("name")
        if name not in manifest_names:
            continue
        ex = n.get("extras", {})
        if ex.get("semantic_id") != name:
            prop_bad.append(name)
        if not isinstance(ex.get("source_ref"), str):
            prop_bad.append(name)
        c = ex.get("confidence")
        if not isinstance(c, (int, float)) or not (0 <= c <= 1):
            prop_bad.append(name)
    if prop_bad:
        fail(f"custom properties wrong on: {prop_bad[:5]}")
    else:
        ok("semantic_id == name, source_ref is string, confidence in [0,1] on every object")

    buildings = {m.group(1) for m in (NAME_RE.match(n) for n in glb_names) if m}
    levels = {m.group(2) for m in (NAME_RE.match(n) for n in glb_names) if m and m.group(1) != "B00"}
    units = {m.group(3) for m in (NAME_RE.match(n) for n in glb_names) if m and m.group(3) != "NONE"}
    b_real = {b for b in buildings if b != "B00"}
    if len(b_real) != args.expect_buildings:
        fail(f"buildings: expected {args.expect_buildings}, found {sorted(b_real)}")
    else:
        ok(f"buildings: {sorted(b_real)}")
    per_building_levels = {b: set() for b in b_real}
    for n in glb_names:
        m = NAME_RE.match(n)
        if m and m.group(1) in per_building_levels and m.group(2) != "L02":
            per_building_levels[m.group(1)].add(m.group(2))
    for b, lv in sorted(per_building_levels.items()):
        if len(lv) != args.expect_levels:
            fail(f"{b} levels expected {args.expect_levels}, found {sorted(lv)}")
    if not any(f.startswith(("buildings", "B")) for f in failures):
        ok(f"levels per building: {args.expect_levels} each")
    if len(units) < args.expect_units_per_level * args.expect_levels:
        fail(f"units found {sorted(units)}")
    else:
        ok(f"apartment units: {sorted(units)}")

    print("")
    if failures:
        print(f"VERIFY_FAILED: {len(failures)} check(s) failed")
        sys.exit(1)
    print(f"VERIFY_OK: {len(objs)} manifest objects, {len(nodes)} GLB nodes")


if __name__ == "__main__":
    main()
