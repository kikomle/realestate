"""Build a small multi-room architectural TEST complex: 2 buildings x 2 levels x 2 apartments.

Run headless:
  Blender -b --factory-startup --python scripts/blender/build_test_complex.py -- --out <path.blend>

Every dimension is an ASSUMPTION (no source drawing): ceiling 2.8 m, wall 0.2 m, slab 0.25 m.
Units: metres. Z-up. Origin: south-west ground corner. X east, Y north, Z up.
Writes <out dir>/build_manifest.json next to the .blend.
"""
import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ASSUMPTION, Namer, assert_contract_name, boolean_cut, make_box, set_props, arg_value  # noqa: E402
import materials  # noqa: E402
import lighting_cameras  # noqa: E402

CEIL = 2.8
SLAB = 0.25
WALL = 0.2
LEVEL_H = CEIL + SLAB  # 3.05
W, D = 12.0, 8.0  # building footprint
GAP = 6.0
DOOR_W, DOOR_H = 0.9, 2.1
WIN_W, WIN_H, WIN_SILL = 1.2, 1.2, 0.9


def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def group(name, parent_col):
    col = bpy.data.collections.new(name)
    parent_col.children.link(col)
    return col


def add(name, bounds, mat, col, manifest, building, level, unit, typ, confidence, extra=None, parent=None):
    assert_contract_name(name)
    ob = make_box(name, bounds, mat, col, parent)
    set_props(ob, confidence, {"building": building, "level": level, "unit": unit, "type": typ, **(extra or {})})
    manifest.append(ob)
    return ob


def build_building(bi, ox, oy, root_col, mats, manifest, cutters):
    B = f"B{bi:02d}"
    bcol = group(B, root_col)
    namer = Namer()
    bobj = bpy.data.objects.new(f"{B}__L00__NONE__roof__000", None)  # empty root for hierarchy
    bobj.empty_display_size = 0.5
    bcol.objects.link(bobj)
    set_props(bobj, 0.2, {"building": B, "level": "L00", "unit": "NONE", "type": "root"})

    t = WALL
    levels = [("L00", 0.0), ("L01", LEVEL_H)]
    for lname, z0 in levels:
        z1 = z0 + CEIL
        lcol = group(f"{B}_{lname}", bcol)

        slab_name = namer(B, lname, "NONE", "slab")
        add(slab_name, (ox, oy, z0 - SLAB, ox + W, oy + D, z0), mats["concrete"], lcol, manifest,
            B, lname, "NONE", "slab", 0.3, parent=bobj)

        sides = {
            "S": (ox, oy, ox + W, oy + t),
            "N": (ox, oy + D - t, ox + W, oy + D),
            "W": (ox, oy, ox + t, oy + D),
            "E": (ox + W - t, oy, ox + W, oy + D),
        }
        for side, (x0, y0, x1, y1) in sides.items():
            wname = namer(B, lname, "NONE", "wall")
            ob = add(wname, (x0, y0, z0, x1, y1, z1), mats["plaster"], lcol, manifest,
                     B, lname, "NONE", "wall", 0.3, {"side": side}, parent=bobj)
            if side == "S" and lname == "L00":
                boolean_cut(ob, (ox + 2.0, oy - 0.1, z0, ox + 2.0 + DOOR_W, oy + t + 0.1, z0 + DOOR_H), cutters)
                dname = namer(B, lname, "NONE", "door")
                ob_d = add(dname, (ox + 2.0, oy + 0.05, z0, ox + 2.0 + DOOR_W, oy + 0.15, z0 + DOOR_H),
                           mats["wood"], lcol, manifest, B, lname, "NONE", "door", 0.25,
                           {"side": "S", "note": "door leaf placeholder"}, parent=bobj)
            if side in ("S", "N") and lname == "L00" and side == "S":
                boolean_cut(ob, (ox + 6.0, oy - 0.1, z0 + WIN_SILL, ox + 6.0 + WIN_W, oy + t + 0.1, z0 + WIN_SILL + WIN_H), cutters)
            if side in ("N", "E", "W"):
                for k in range(2):
                    if side == "N":
                        wx = ox + 2.5 + k * 4.0
                        cut_b = (wx, oy + D - t - 0.1, z0 + WIN_SILL, wx + WIN_W, oy + D + 0.1, z0 + WIN_SILL + WIN_H)
                    elif side == "E":
                        wy = oy + 2.5 + k * 3.5
                        cut_b = (ox + W - t - 0.1, wy, z0 + WIN_SILL, ox + W + 0.1, wy + WIN_W, z0 + WIN_SILL + WIN_H)
                    else:
                        wy = oy + 2.5 + k * 3.5
                        cut_b = (ox - 0.1, wy, z0 + WIN_SILL, ox + t + 0.1, wy + WIN_W, z0 + WIN_SILL + WIN_H)
                    boolean_cut(ob, cut_b, cutters)
                    gname = namer(B, lname, "NONE", "window")
                    add(gname, (cut_b[0] + 0.02 if side != "E" and side != "W" else cut_b[0] + 0.05,
                                cut_b[1] + 0.02 if side != "N" else cut_b[1] + 0.05,
                                cut_b[2], cut_b[3] - 0.02 if side != "E" and side != "W" else cut_b[3] - 0.05,
                                cut_b[4] - 0.02 if side != "N" else cut_b[4] - 0.05,
                                cut_b[5]),
                        mats["glass"], lcol, manifest, B, lname, "NONE", "window", 0.25, {"side": side},
                        parent=bobj)

        # partition splitting the floor into two apartments
        xm = ox + W / 2
        pname = namer(B, lname, "NONE", "wall")
        add(pname, (xm - t / 2, oy + t, z0, xm + t / 2, oy + D - t, z1), mats["plaster"], lcol, manifest,
            B, lname, "NONE", "wall", 0.3, {"side": "partition"}, parent=bobj)

        for ai, unit in enumerate([f"U{lname[-1]}01", f"U{lname[-1]}02"]):
            ux0, ux1 = (ox, xm) if ai == 0 else (xm, ox + W)
            ymid = oy + D / 2
            ucol = group(f"{B}_{lname}_{unit}", lcol)
            cname = namer(B, lname, unit, "wall")
            cw = add(cname, (ux0 + t / 2, ymid - t / 2, z0, ux1 - t / 2, ymid + t / 2, z1), mats["plaster"],
                     ucol, manifest, B, lname, unit, "wall", 0.3, {"side": "room_partition"}, parent=bobj)
            boolean_cut(cw, (ux0 + 2.0, ymid - t / 2 - 0.1, z0, ux0 + 2.0 + DOOR_W, ymid + t / 2 + 0.1, z0 + DOOR_H), cutters)

            bal_b = (ux0 + 1.0, oy + D, z0 - SLAB, ux1 - 1.0, oy + D + 1.8, z0 - SLAB + 0.15)
            add(namer(B, lname, unit, "balcony"), bal_b, mats["concrete"], ucol, manifest,
                B, lname, unit, "balcony", 0.25, parent=bobj)

    # stair L00 -> L01 along the south-west corner
    scol = group(f"{B}_stair", bcol)
    steps = 16
    run = 3.0
    rise = LEVEL_H / steps
    for s in range(steps):
        y0 = oy + 0.4 + s * (run / steps)
        add(namer(B, "L00", "NONE", "stair"),
            (ox + 0.4, y0, s * rise, ox + 1.6, y0 + run / steps, (s + 1) * rise),
            mats["concrete"], scol, manifest, B, "L00", "NONE", "stair", 0.25, {"step": s + 1}, parent=bobj)

    add(namer(B, "L01", "NONE", "roof"), (ox, oy, LEVEL_H + CEIL, ox + W, oy + D, LEVEL_H + CEIL + 0.3),
        mats["concrete"], bcol, manifest, B, "L01", "NONE", "roof", 0.3, parent=bobj)
    add(namer(B, "L00", "NONE", "column"), (ox + W - 0.4, oy + D - 0.4, -SLAB, ox + W, oy + D, LEVEL_H + CEIL),
        mats["concrete"], bcol, manifest, B, "L00", "NONE", "column", 0.25, parent=bobj)
    return bobj


def build_site(root_col, mats, manifest):
    scol = group("SITE", root_col)
    ob = add("B00__L00__NONE__site__001", (-6.0, -6.0, -0.3, 2 * W + GAP + 6.0, D + 6.0, 0.0),
             mats["ground"], scol, manifest, "B00", "L00", "NONE", "site", 0.2,
             {"note": "site plane; top at z=0 is ground level"})
    return ob


def main():
    out = os.path.abspath(arg_value("--out", "scripts/blender/out/test_complex.blend"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    clean()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"

    cutters = group("_cutters", scene.collection)
    cutters.hide_viewport = True
    cutters.hide_render = True

    mats = {
        "plaster": materials.make_plaster(),
        "concrete": materials.make_concrete(),
        "wood": materials.make_wood(),
        "glass": materials.make_glass(),
        "ground": materials.make_ground(),
    }
    manifest = []
    root = group("COMPLEX", scene.collection)
    for bi, ox in enumerate([0.0, W + GAP], start=1):
        build_building(bi, ox, 0.0, root, mats, manifest, cutters)
    build_site(root, mats, manifest)

    for ob in list(cutters.objects):
        bpy.data.objects.remove(ob, do_unlink=True)

    lighting_cameras.setup(scene, scene.collection)

    entries = []
    for ob in manifest:
        entries.append({"name": ob.name, "building": ob["building"], "level": ob["level"],
                        "unit": ob["unit"], "type": ob["type"], "source_ref": ob["source_ref"],
                        "confidence": ob["confidence"], "assumption": ASSUMPTION})
    with open(os.path.join(os.path.dirname(out), "build_manifest.json"), "w") as fh:
        json.dump({"objects": entries, "assumption": ASSUMPTION}, fh, indent=2)

    bpy.ops.wm.save_as_mainfile(filepath=out)
    print("BUILD_OK", out, "objects", len(manifest), flush=True)


if __name__ == "__main__":
    main()
