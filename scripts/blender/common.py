"""Shared helpers for the Blender pipeline. Runs inside Blender's bundled Python."""
import os
import re
import sys

import bpy
import bmesh

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
ASSUMPTION = "ASSUMPTION_TEST_GEOMETRY"
TYPES = ("wall", "slab", "window", "door", "balcony", "stair", "column", "roof", "site")
NAME_RE = re.compile(r"^(B\d{2})__(L[M]?\d{2})__(NONE|U\d{3})__(wall|slab|window|door|balcony|stair|column|roof|site)__(\d{3})$")


def script_args():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def arg_value(name, default=None):
    args = script_args()
    if name in args:
        return args[args.index(name) + 1]
    return default


def arg_flag(name):
    return name in script_args()


class Namer:
    """Contract names {BUILDING}__{LEVEL}__{UNIT}__{TYPE}__{INDEX}, index counted per (B, L, U, TYPE)."""

    def __init__(self):
        self.counts = {}

    def __call__(self, building, level, unit, typ):
        key = (building, level, unit, typ)
        self.counts[key] = self.counts.get(key, 0) + 1
        return f"{building}__{level}__{unit}__{typ}__{self.counts[key]:03d}"


def assert_contract_name(name):
    if not NAME_RE.match(name):
        raise ValueError(f"object name violates contract: {name}")


def open_blend(path):
    bpy.ops.wm.open_mainfile(filepath=path)


def set_props(ob, confidence, extra=None):
    ob["semantic_id"] = ob.name
    ob["source_ref"] = "UNKNOWN"
    ob["confidence"] = float(confidence)
    ob["assumption"] = ASSUMPTION
    for key, value in (extra or {}).items():
        ob[key] = value


def make_box(name, bounds, material, collection, parent=None):
    x0, y0, z0, x1, y1, z1 = bounds
    verts = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name + "_mesh")
    me.from_pydata(verts, [], faces)
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    if material is not None:
        me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def boolean_cut(target, bounds, cutter_collection):
    """Apply an exact boolean DIFFERENCE of a box cutter from target, then delete the cutter."""
    cutter = make_box("__cutter", bounds, None, cutter_collection)
    bpy.context.view_layer.objects.active = target
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    target.select_set(True)
    mod = target.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
