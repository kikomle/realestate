"""Export glTF 2.0 (.glb, Y-up) and manifest.json from a built .blend.

Run headless:
  Blender -b --factory-startup <file.blend> --python scripts/blender/export_glb.py -- --glb <out.glb> --manifest <out.json>

Node names are preserved (glTF node.name = Blender object name). Transforms are applied before export.
Custom props semantic_id / source_ref / confidence / assumption are written as glTF extras.
Manifest bbox is in metres, Blender Z-up world space (the shared contract frame); the GLB itself is Y-up.
"""
import json
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import arg_value  # noqa: E402


def world_bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = [round(min(p[i] for p in pts), 4) for i in range(3)]
    hi = [round(max(p[i] for p in pts), 4) for i in range(3)]
    return {"min": lo, "max": hi, "size": [round(hi[i] - lo[i], 4) for i in range(3)]}


def tri_count(ob):
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh() if ob.modifiers else ob.data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    if ob.modifiers:
        ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    return n


def main():
    glb = os.path.abspath(arg_value("--glb", "scripts/blender/out/test_complex.glb"))
    manifest_path = os.path.abspath(arg_value("--manifest", "scripts/blender/out/test_complex.manifest.json"))
    os.makedirs(os.path.dirname(glb), exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    meshable = [ob for ob in bpy.data.objects if ob.type in {"MESH", "EMPTY"}
                and not ob.name.startswith("RIG__") and not ob.name.startswith("CAM_")]
    for ob in meshable:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshable[0]

    # Bake transforms of mesh objects (world frame) so glTF nodes carry identity-equivalent transforms.
    for ob in meshable:
        if ob.type == "MESH" and ob.parent is None:
            ob.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.export_scene.gltf(
        filepath=glb,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_lights=False,
        export_cameras=False,
    )

    entries = []
    for ob in sorted(meshable, key=lambda o: o.name):
        if ob.type == "EMPTY":
            kind = "root"
            tris = 0
            bbox = None
            mats = []
        else:
            kind = ob.get("type", "mesh")
            tris = tri_count(ob)
            bbox = world_bbox(ob)
            mats = [s.material.name for s in ob.material_slots if s.material]
        entries.append({
            "id": ob.name,
            "name": ob.name,
            "parent": ob.parent.name if ob.parent else None,
            "building": ob.get("building"),
            "level": ob.get("level"),
            "unit": ob.get("unit"),
            "type": kind,
            "bbox_m": bbox,
            "triangles": tris,
            "materials": mats,
            "source_ref": ob.get("source_ref", "UNKNOWN"),
            "confidence": ob.get("confidence"),
        })

    manifest = {
        "schema": "realestate2.blender-manifest/1",
        "units": "meters",
        "frame": "Blender Z-up; glTF file is Y-up (exporter converts)",
        "origin": "south-west ground corner of complex",
        "assumption": "ASSUMPTION_TEST_GEOMETRY: all dimensions are pipeline test values, not source-verified",
        "glb": os.path.basename(glb),
        "object_count": len(entries),
        "objects": entries,
    }
    with open(manifest_path, "w") as fh:
        json.dump(manifest, fh, indent=2)
    print("EXPORT_OK", glb, "objects", len(entries), "manifest", manifest_path, flush=True)


if __name__ == "__main__":
    main()
