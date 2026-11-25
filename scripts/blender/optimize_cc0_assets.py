"""Optimize downloaded CC0 3D tree, shrub, and car models in Blender for fast WebGL.

For foliage assets (Poly Haven tree_small_02 & shrub_01), separates leaf geometry
from woody trunk/branches, decimates individual leaves cleanly before keeping
thousands of evenly distributed whole leaf clusters enlarged around their centers
so the real Poly Haven textured canopy stays lush, full, and vibrant green at ~1.5 MB.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/optimize_cc0_assets.py
"""
import os
import random
import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CC0_DIR = os.path.join(ROOT, "assets/blender/cc0")
OUT_DIR = os.path.join(ROOT, "public/models/cc0")
os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_lush_canopy_from_leaves(ob, target_islands=3200, leaf_scale=3.4, seed=42):
    """Simplify high-poly Poly Haven leaf mesh into thousands of lush textured 3D leaf clusters."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    total_faces = len(bm.faces)
    if total_faces == 0:
        bm.free()
        return

    # Group connected faces into individual leaf/twig islands
    visited = [False] * total_faces
    islands = []
    for f in bm.faces:
        if visited[f.index]:
            continue
        stack = [f]
        visited[f.index] = True
        island = []
        while stack:
            cur = stack.pop()
            island.append(cur)
            for e in cur.edges:
                for lf in e.link_faces:
                    if not visited[lf.index]:
                        visited[lf.index] = True
                        stack.append(lf)
        islands.append(island)

    rng = random.Random(seed)
    rng.shuffle(islands)

    # First keep up to target_islands evenly distributed across the real tree crown
    kept_islands = islands[:target_islands]
    delete_faces = [f for isl in islands[target_islands:] for f in isl]

    # Within each kept island, enlarge around its centroid so the real leaf silhouette fills the crown richly
    for isl in kept_islands:
        verts = list({v for f in isl for v in f.verts})
        if not verts:
            continue
        center = sum((v.co for v in verts), Vector((0.0, 0.0, 0.0))) / len(verts)
        for v in verts:
            v.co = center + (v.co - center) * leaf_scale

    if delete_faces:
        bmesh.ops.delete(bm, geom=delete_faces, context="FACES")

    bm.to_mesh(me)
    bm.free()
    me.update()

    # Now gently collapse-decimate redundant internal leaf subdivisions while keeping every enlarged leaf blade intact!
    me.calc_loop_triangles()
    cur_tris = len(me.loop_triangles)
    if cur_tris > 26000:
        mod = ob.modifiers.new("LeafDecimate", "DECIMATE")
        mod.ratio = max(0.18, min(0.85, 24000.0 / cur_tris))
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            ob.modifiers.remove(mod)


def fix_foliage_materials():
    """Ensure solid JPG leaf materials export as vibrant OPAQUE green foliage (no broken alpha sorting)."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = None
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                bsdf = node
        if bsdf:
            alpha_inp = bsdf.inputs.get("Alpha")
            if alpha_inp:
                for link in list(alpha_inp.links):
                    mat.node_tree.links.remove(link)
                alpha_inp.default_value = 1.0
            if hasattr(mat, "blend_method"):
                mat.blend_method = "OPAQUE"


def normalize_and_export(
    src_path,
    dst_path,
    target_height_m=None,
    target_length_m=None,
    is_foliage=False,
    wood_decimate=0.05,
    target_leaf_islands=3200,
    leaf_scale=3.4,
    car_decimate=0.06,
    max_tex=512,
    strip_prefixes=(),
):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=src_path)

    if strip_prefixes:
        for ob in list(bpy.data.objects):
            if ob.type == "MESH" and any(ob.name.startswith(p) for p in strip_prefixes):
                bpy.data.objects.remove(ob, do_unlink=True)

    meshes = [ob for ob in bpy.data.objects if ob.type == "MESH"]
    if not meshes:
        print("NO MESHES:", src_path)
        return

    bpy.ops.object.select_all(action="DESELECT")
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    if is_foliage:
        for ob in list(meshes):
            if len(ob.data.materials) > 1:
                bpy.ops.object.select_all(action="DESELECT")
                ob.select_set(True)
                bpy.context.view_layer.objects.active = ob
                bpy.ops.mesh.separate(type="MATERIAL")
        meshes = [ob for ob in bpy.data.objects if ob.type == "MESH"]
        fix_foliage_materials()

    total_before = 0
    total_after = 0
    for ob in meshes:
        me = ob.data
        me.calc_loop_triangles()
        tris = len(me.loop_triangles)
        total_before += tris
        mat_names = " ".join((m.name.lower() if m else "") for m in me.materials)
        is_leaf_part = is_foliage and (
            "leaf" in mat_names or "leaves" in mat_names or "foliage" in mat_names or "shrub" in mat_names
        )

        if is_leaf_part:
            build_lush_canopy_from_leaves(ob, target_islands=target_leaf_islands, leaf_scale=leaf_scale)
        else:
            ratio = wood_decimate if is_foliage else car_decimate
            if ratio < 0.99 and tris > 400:
                mod = ob.modifiers.new("DecimateWeb", "DECIMATE")
                mod.ratio = max(0.01, min(1.0, ratio))
                bpy.context.view_layer.objects.active = ob
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except Exception:
                    ob.modifiers.remove(mod)

        ob.data.calc_loop_triangles()
        total_after += len(ob.data.loop_triangles)

    mins = [1e9, 1e9, 1e9]
    maxs = [-1e9, -1e9, -1e9]
    for ob in meshes:
        for c in ob.bound_box:
            p = ob.matrix_world @ Vector(c)
            for i in range(3):
                mins[i] = min(mins[i], p[i])
                maxs[i] = max(maxs[i], p[i])

    size = [maxs[i] - mins[i] for i in range(3)]
    cx = (mins[0] + maxs[0]) * 0.5
    cy = (mins[1] + maxs[1]) * 0.5
    z0 = mins[2]

    scale = 1.0
    if target_height_m and size[2] > 1e-4:
        scale = target_height_m / size[2]
    elif target_length_m and max(size[0], size[1]) > 1e-4:
        scale = target_length_m / max(size[0], size[1])

    for ob in meshes:
        ob.location.x = (ob.location.x - cx) * scale
        ob.location.y = (ob.location.y - cy) * scale
        ob.location.z = (ob.location.z - z0) * scale
        ob.scale = (ob.scale.x * scale, ob.scale.y * scale, ob.scale.z * scale)

    bpy.ops.object.select_all(action="DESELECT")
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for img in bpy.data.images:
        if img.size[0] > max_tex or img.size[1] > max_tex:
            ratio = min(max_tex / img.size[0], max_tex / img.size[1])
            nw = max(64, int(img.size[0] * ratio))
            nh = max(64, int(img.size[1] * ratio))
            try:
                img.scale(nw, nh)
            except Exception:
                pass

    bpy.ops.export_scene.gltf(
        filepath=dst_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_image_format="JPEG",
        export_jpeg_quality=80,
        export_draco_mesh_compression_enable=False,
    )
    kb = os.path.getsize(dst_path) / 1024.0
    print(
        f"OPT_OK {os.path.basename(dst_path)}: tris {total_before}->{total_after}, "
        f"orig_size={[round(s,2) for s in size]}, scale={scale:.3f}, {kb:.1f} KB",
        flush=True,
    )


def main():
    # 1. Pre-made CC0 Tree (Poly Haven tree_small_02) — keep 3,600 lush scaled leaf blades!
    tree_src = os.path.join(CC0_DIR, "trees/tree_small_02/tree_small_02_1k.gltf")
    if os.path.exists(tree_src):
        normalize_and_export(
            tree_src,
            os.path.join(OUT_DIR, "tree_small.glb"),
            target_height_m=5.8,
            is_foliage=True,
            wood_decimate=0.05,
            target_leaf_islands=3600,
            leaf_scale=4.2,
            max_tex=512,
        )

    # 2. Pre-made CC0 Shrub (Poly Haven shrub_01) — normalized by width so it stays a compact bushy shrub
    shrub_src = os.path.join(CC0_DIR, "trees/shrub_01/shrub_01_1k.gltf")
    if os.path.exists(shrub_src):
        normalize_and_export(
            shrub_src,
            os.path.join(OUT_DIR, "shrub.glb"),
            target_length_m=1.65,
            is_foliage=True,
            wood_decimate=0.08,
            target_leaf_islands=1400,
            leaf_scale=2.6,
            max_tex=384,
        )

    # 3. Pre-made CC0 Modern Car (Khronos CarConcept)
    car_src = os.path.join(CC0_DIR, "cars/car_concept_khronos.glb")
    if os.path.exists(car_src):
        normalize_and_export(
            car_src,
            os.path.join(OUT_DIR, "car_modern.glb"),
            target_length_m=4.45,
            is_foliage=False,
            car_decimate=0.06,
            max_tex=384,
            strip_prefixes=("Engine", "InteriorPedal", "InteriorSteering", "InteriorFloormat", "BodyHoodInterior"),
        )


if __name__ == "__main__":
    main()
