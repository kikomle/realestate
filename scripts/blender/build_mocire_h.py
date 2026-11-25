"""Build a 1:1 floorplan-exact, cinematic golden-hour 3D model of Močire Zadar H + surroundings.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_mocire_h.py

Priority rule: Where exterior marketing renders differ from architectural floorplans
(e.g. L04 South cantilevered balconies and exact window counts), the floorplans take priority.

Reads:  assets/geometry/mocire-h-3d-calibration.json
        assets/blender/materials/mocire/*.jpg
Writes: assets/blender/mocire_h.blend
        public/models/mocire-h/mocire_h.glb
        public/models/mocire-h/mocire_h.manifest.json
"""
import json
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CALIB_PATH = os.path.join(ROOT, "assets/geometry/mocire-h-3d-calibration.json")
TEX_DIR = os.path.join(ROOT, "assets/blender/materials/mocire")
BLEND_OUT = os.path.join(ROOT, "assets/blender/mocire_h.blend")
GLB_OUT = os.path.join(ROOT, "public/models/mocire-h/mocire_h.glb")
MANIFEST_OUT = os.path.join(ROOT, "public/models/mocire-h/mocire_h.manifest.json")

SOURCE_REF = "FLOORPLAN_1_TO_1_CALIBRATED_WITH_EXTERIOR_RENDERS"
RNG = random.Random(2026)

# ------------------------------------------------------------------
# 1:1 FLOORPLAN-EXTRACTED ARCHITECTURAL COORDINATES (meters, X=West->East, Y=South->North)
# Every single window, balcony, loggia, and bay comes directly from the 6 floorplan PNGs/SVGs.
# ------------------------------------------------------------------

# L00 (Prizemlje) grouped double-leaf terrace doors & windows (from floor-prizemlje.png)
L00_SOUTH_DOORS = [
    (0.89, 2.54), (4.10, 5.71), (6.85, 8.37), (9.85, 11.46),
    (12.86, 14.38), (15.69, 17.30), (18.18, 19.71), (21.14, 22.75), (23.39, 24.99),
    # Central main glass entrance foyer (26.18..32.14) handled separately
    (36.16, 37.76), (38.95, 40.51), (41.99, 43.60), (44.87, 46.47),
    (48.00, 49.60), (50.66, 52.18), (53.41, 54.93), (56.71, 58.23),
    (59.41, 60.98), (62.37, 63.98),
]
L00_NORTH_DOORS = [
    (0.89, 2.54), (3.98, 5.58), (6.85, 8.37), (10.19, 11.71),
    (12.98, 14.55), (15.82, 17.38), (18.02, 19.54), (20.89, 22.45),
    (23.72, 25.33), (27.11, 28.67), (29.69, 31.21), (32.73, 34.25),
    (36.16, 37.68), (38.95, 40.51), (41.99, 43.60), (44.91, 46.43),
    (48.25, 49.81), (50.79, 52.39), (53.41, 55.02), (56.33, 57.93),
    (59.41, 60.94), (62.37, 63.98),
]
L00_GABLE_WINDOWS = [(1.20, 1.85), (13.10, 13.75), (16.97, 18.05)]
L00_SOUTH_DIVIDERS = [12.35, 17.72, 25.96, 41.31, 47.36, 55.73]
L00_NORTH_DIVIDERS = [9.26, 17.63, 26.13, 35.14, 41.31, 47.36, 52.73, 58.78]

# L01-L03 exact 1:1 South balconies, South solid windows, North loggias, North windows, Gable windows
L13_SOUTH_BALCONIES = [
    (3.65, 6.49, None),        # H _.16
    (12.44, 15.04, None),      # H _.17
    (20.89, 25.38, 23.15),     # H _.18 + H _.19 paired
    (38.33, 44.04, 41.20),     # H _.1 + H _.2 paired
    (49.96, 52.52, None),      # H _.3
    (58.47, 61.38, None),      # H _.4
]
L13_SOUTH_WINDOWS = [
    (1.12, 2.50), (7.23, 8.62), (10.24, 11.63), (16.02, 17.41),
    (18.22, 19.57), (26.63, 28.02), (30.01, 31.20), (36.10, 37.48),
    (44.99, 46.37), (48.06, 49.45), (53.44, 54.79), (56.45, 57.80), (62.33, 63.71),
]
L13_NORTH_LOGGIAS = [
    (3.96, 6.25), (6.69, 9.06),
    (15.89, 17.61), (18.02, 19.77),
    (26.63, 28.93), (29.34, 31.74),
    (38.67, 40.97), (41.37, 43.77),
    (50.60, 52.29), (52.69, 55.09),
    (58.78, 61.08),
]
L13_NORTH_WINDOWS = [
    (1.11, 2.50), (10.31, 11.66), (13.38, 14.74), (20.92, 22.27),
    (24.00, 25.38), (32.95, 34.14), (36.03, 37.42), (44.99, 46.37),
    (48.06, 49.45), (56.24, 57.63), (62.36, 63.71),
]
L13_GABLE_WINDOWS = [(0.81, 2.03), (5.14, 5.81), (12.95, 13.65), (16.76, 17.95)]

# L04 + Galerija exact 1:1 from floor-etaza-4.png & floor-galerije.png
# Floorplan priority: L04 South balconies project outward just like L01-L03!
L04_SOUTH_GLASS_BAYS = [
    (0.00, 3.45), (9.67, 15.21), (20.52, 25.75),
    (35.19, 38.43), (44.45, 50.02), (52.52, 55.70), (61.31, 64.83),
]
L04_NORTH_GLASS_BAYS = [
    (0.00, 3.45), (9.70, 15.28), (20.35, 25.89),
    (32.38, 37.96), (44.41, 49.99), (52.52, 55.70), (61.35, 64.83),
]
L04_SOUTH_BALCONIES = [
    (3.68, 9.26, 6.49),        # H 4.17 + H 4.18
    (15.65, 20.01, 17.81),     # H 4.19 + H 4.20
    (26.06, 28.53, None),      # H 4.21
    (38.43, 44.01, 41.20),     # H 4.1 + H 4.2
    (50.02, 52.49, None),      # H 4.3
    (55.74, 61.31, 58.57),     # H 4.4 + H 4.5
]
L04_NORTH_LOGGIAS = [
    (3.68, 9.45, 6.49),
    (15.55, 20.10, 17.81),
    (26.15, 32.15, 29.15),
    (38.20, 44.18, 41.20),
    (50.20, 52.35, None),
    (55.90, 61.15, 58.57),
]
# Exact 1:1 upper gallery windows from floor-galerije.png!
L04_GALLERY_SOUTH_WINDOWS = [
    (4.50, 5.85), (7.30, 8.65), (16.05, 16.76), (18.93, 19.60),
    (26.63, 28.02), (30.01, 30.69), (33.02, 34.20), (39.11, 39.78),
    (42.55, 43.23), (50.63, 51.81), (56.38, 57.76), (59.18, 60.57),
]
L04_GALLERY_NORTH_WINDOWS = [
    (4.46, 5.85), (7.27, 8.69), (16.05, 16.76), (19.03, 19.70),
    (26.94, 28.16), (30.22, 31.40), (39.11, 39.78), (42.55, 43.23),
    (50.80, 52.02), (56.17, 57.56), (59.18, 60.57),
]
L04_LOWER_GABLE_WINDOWS_W = [(5.08, 5.79), (13.03, 13.72)]
L04_GALLERY_GABLE_WINDOWS = [(6.40, 7.80), (10.95, 12.35)]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_pbr_mat(
    name,
    base_rgba,
    albedo_file=None,
    rough_file=None,
    normal_file=None,
    normal_strength=0.65,
    roughness=0.78,
    metallic=0.0,
    emission_rgba=None,
    emission_strength=0.0,
):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_rgba[:3], 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if emission_rgba and emission_strength > 0:
        bsdf.inputs["Emission Color"].default_value = (*emission_rgba[:3], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    if albedo_file:
        path = os.path.join(TEX_DIR, albedo_file)
        if os.path.exists(path):
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(path, check_existing=True)
            tex.image.pack()
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    if rough_file:
        path = os.path.join(TEX_DIR, rough_file)
        if os.path.exists(path):
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(path, check_existing=True)
            tex.image.colorspace_settings.name = "Non-Color"
            tex.image.pack()
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Roughness"])

    if normal_file:
        path = os.path.join(TEX_DIR, normal_file)
        if os.path.exists(path):
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(path, check_existing=True)
            tex.image.colorspace_settings.name = "Non-Color"
            tex.image.pack()
            nmap = nt.nodes.new("ShaderNodeNormalMap")
            nmap.inputs["Strength"].default_value = normal_strength
            nt.links.new(tex.outputs["Color"], nmap.inputs["Color"])
            nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def box_project_uv(bm, tile_m=4.0):
    uv_layer = bm.loops.layers.uv.verify()
    inv = 1.0 / max(tile_m, 0.01)
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                loop[uv_layer].uv = (co.x * inv, co.y * inv)
            elif ax >= ay:
                loop[uv_layer].uv = (co.y * inv, co.z * inv)
            else:
                loop[uv_layer].uv = (co.x * inv, co.z * inv)


class Builder:
    def __init__(self, scene):
        self.scene = scene
        self.counts = {}
        self.objects = []
        self.cols = {}

    def get_col(self, name, parent=None):
        if name in self.cols:
            return self.cols[name]
        col = bpy.data.collections.new(name)
        (parent or self.scene.collection).children.link(col)
        self.cols[name] = col
        return col

    def next_name(self, building, level, unit, typ):
        key = (building, level, unit, typ)
        idx = self.counts.get(key, 0) + 1
        self.counts[key] = idx
        return f"{building}__{level}__{unit}__{typ}__{idx:03d}"

    def add_mesh(self, building, level, unit, typ, bm, mat, col_name, uv_tile=4.0, confidence=0.7, smooth=False):
        if len(bm.verts) == 0:
            bm.free()
            return None
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        box_project_uv(bm, tile_m=uv_tile)
        name = self.next_name(building, level, unit, typ)
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        if smooth:
            for p in mesh.polygons:
                p.use_smooth = True
        mesh.materials.append(mat)
        ob = bpy.data.objects.new(name, mesh)
        self.get_col(col_name).objects.link(ob)
        ob["semantic_id"] = name
        ob["source_ref"] = SOURCE_REF
        ob["confidence"] = confidence
        ob["building"] = building
        ob["level"] = level
        ob["unit"] = unit
        ob["type"] = typ
        self.objects.append(ob)
        return ob


def add_box(bm, x0, y0, z0, x1, y1, z1):
    if x1 <= x0 + 1e-4 or y1 <= y0 + 1e-4 or z1 <= z0 + 1e-4:
        return
    dx, dy, dz = x1 - x0, y1 - y0, z1 - z0
    cx, cy, cz = (x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5
    res = bmesh.ops.create_cube(bm, size=1.0)
    for v in res["verts"]:
        v.co.x = v.co.x * dx + cx
        v.co.y = v.co.y * dy + cy
        v.co.z = v.co.z * dz + cz


def complement_spans(x_start, x_end, holes):
    sorted_holes = sorted((max(x_start, h[0]), min(x_end, h[1])) for h in holes if h[1] > x_start and h[0] < x_end)
    solids = []
    cur = x_start
    for a, b in sorted_holes:
        if a > cur + 0.05:
            solids.append((cur, a))
        cur = max(cur, b)
    if x_end > cur + 0.05:
        solids.append((cur, x_end))
    return solids


def add_organic_tree(bm_trunks, bm_foliage_dark, bm_foliage_light, tx, ty, bz=0.0, scale=1.0):
    h_trunk = 1.9 * scale
    res = bmesh.ops.create_cone(
        bm_trunks, cap_ends=True, cap_tris=False, segments=8,
        radius1=0.15 * scale, radius2=0.09 * scale, depth=h_trunk,
    )
    for v in res["verts"]:
        v.co.x += tx
        v.co.y += ty
        v.co.z += bz + h_trunk * 0.5

    puffs = [
        (0.0, 0.0, 2.80, 1.38, 1.04, bm_foliage_dark),
        (-0.72, 0.42, 2.58, 1.04, 0.92, bm_foliage_light),
        (0.76, -0.36, 2.62, 1.08, 0.94, bm_foliage_light),
        (0.26, 0.68, 2.98, 0.96, 0.88, bm_foliage_light),
        (-0.48, -0.58, 2.50, 0.98, 0.90, bm_foliage_dark),
        (0.05, -0.08, 3.44, 1.02, 0.82, bm_foliage_light),
    ]
    for dx, dy, dz, rad, squash_z, target_bm in puffs:
        jx = (RNG.random() - 0.5) * 0.24 * scale
        jy = (RNG.random() - 0.5) * 0.24 * scale
        res = bmesh.ops.create_icosphere(target_bm, subdivisions=2, radius=rad * scale)
        for v in res["verts"]:
            jitter = 1.0 + (RNG.random() - 0.5) * 0.12
            v.co.x = v.co.x * jitter + tx + dx * scale + jx
            v.co.y = v.co.y * jitter + ty + dy * scale + jy
            v.co.z = v.co.z * squash_z * jitter + bz + dz * scale


def add_cypress_tree(bm_trunks, bm_foliage_dark, tx, ty, bz=0.0, height=7.5):
    """Slender Mediterranean cypress tree framing Zadar residential lots."""
    res = bmesh.ops.create_cone(
        bm_trunks, cap_ends=True, cap_tris=False, segments=7,
        radius1=0.14, radius2=0.08, depth=1.6,
    )
    for v in res["verts"]:
        v.co.x += tx; v.co.y += ty; v.co.z += bz + 0.8
    # Tall tapered organic spire built from 4 overlapping stretched spheres
    for frac, rad, hz in ((0.28, 0.92, 1.8), (0.50, 0.82, 1.9), (0.72, 0.62, 1.7), (0.90, 0.34, 1.3)):
        res = bmesh.ops.create_icosphere(bm_foliage_dark, subdivisions=2, radius=1.0)
        for v in res["verts"]:
            v.co.x = v.co.x * rad + tx
            v.co.y = v.co.y * rad + ty
            v.co.z = v.co.z * hz + bz + 1.0 + frac * (height - 1.5)


def add_bush(bm_foliage, bx, by, bz, rx=0.85, ry=0.65, rz=0.52):
    for dx, dy, s in ((0.0, 0.0, 1.0), (-0.42, 0.14, 0.78), (0.44, -0.10, 0.82)):
        res = bmesh.ops.create_icosphere(bm_foliage, subdivisions=2, radius=1.0)
        for v in res["verts"]:
            v.co.x = v.co.x * rx * s + bx + dx * rx
            v.co.y = v.co.y * ry * s + by + dy * ry
            v.co.z = v.co.z * rz * s + bz + rz * 0.65


def add_parked_car(bm_body, bm_glass, bm_wheel, cx, cy, z0=0.0, heading=0.0):
    """Add a sleek stylized European SUV/sedan parked in the grass-grid bays for scale."""
    L, Wc = 4.45, 1.86
    cos_h, sin_h = math.cos(heading), math.sin(heading)

    def xform(bm, x0, y0, z_a, x1, y1, z_b):
        dx, dy, dz = x1 - x0, y1 - y0, z_b - z_a
        lx, ly, lz = (x0 + x1) * 0.5, (y0 + y1) * 0.5, (z_a + z_b) * 0.5
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res["verts"]:
            px = v.co.x * dx + lx
            py = v.co.y * dy + ly
            pz = v.co.z * dz + lz
            v.co.x = cx + px * cos_h - py * sin_h
            v.co.y = cy + px * sin_h + py * cos_h
            v.co.z = z0 + pz

    # Lower body chassis
    xform(bm_body, -Wc * 0.5, -L * 0.5, 0.24, Wc * 0.5, L * 0.5, 0.88)
    # Upper cabin greenhouse
    xform(bm_body, -Wc * 0.43, -L * 0.26, 0.88, Wc * 0.43, L * 0.28, 1.44)
    # Tinted windows wrap
    xform(bm_glass, -Wc * 0.445, -L * 0.22, 0.91, Wc * 0.445, L * 0.24, 1.38)
    xform(bm_glass, -Wc * 0.40, -L * 0.275, 0.91, Wc * 0.40, L * 0.295, 1.38)
    # 4 Wheels
    for wx in (-Wc * 0.46, Wc * 0.46):
        for wy in (-L * 0.30, L * 0.30):
            xform(bm_wheel, wx - 0.12, wy - 0.32, 0.02, wx + 0.12, wy + 0.32, 0.62)


def add_j_building(
    bm_ground,
    bm_dark,
    bm_pale,
    bm_hood,
    bm_glass,
    bm_backing,
    bm_warm,
    bm_mullion,
    bm_sill,
    bm_roof,
    x0,
    y0,
    width_x,
    length_y,
    bay_count_long=5,
    z_base=0.0,
):
    """Model Močire Zadar J1 or J2 accurately from Sigma's real photos (mocire-zadar-h-1, h-8, v2-1).

    Clean non-overlapping layered window construction (zero z-fighting):
    - Wall face at 0.00
    - Interior backing / warm glow at +0.015..+0.035 (strictly proud of wall, strictly behind glass)
    - Reflective glass pane at +0.045..+0.068 (strictly proud of backing)
    - Anthracite aluminum frame & mullions at -0.01..+0.105 (cleanly frames glass on all sides)
    - Light stone sill at -0.02..+0.145
    - Ground-floor glazing mounted directly on the inset (+0.30m) plinth wall (never floating)
    """
    x1 = x0 + width_x
    y1 = y0 + length_y
    z_g1 = z_base + 3.0
    z_d1 = z_base + 8.8
    z_top = z_base + 14.6
    G_IN = 0.30

    # Ground floor recessed pale plinth
    add_box(bm_ground, x0 + G_IN, y0 + G_IN, z_base, x1 - G_IN, y1 - G_IN, z_g1)
    # Two dark charcoal-taupe middle stories (Floors 1–2)
    add_box(bm_dark, x0, y0, z_g1, x1, y1, z_d1)
    # Pale cream-limestone upper duplex (Floors 3–4)
    add_box(bm_pale, x0, y0, z_d1, x1, y1, z_top)

    # Flat gravel roof + crisp parapet + raised architectural stair/skylight rooftop boxes
    add_box(bm_roof, x0, y0, z_top, x1, y1, z_top + 0.32)
    add_box(bm_pale, x0, y0, z_top + 0.32, x1, y0 + 0.35, z_top + 0.62)
    add_box(bm_pale, x0, y1 - 0.35, z_top + 0.32, x1, y1, z_top + 0.62)
    add_box(bm_pale, x0, y0 + 0.35, z_top + 0.32, x0 + 0.35, y1 - 0.35, z_top + 0.62)
    add_box(bm_pale, x1 - 0.35, y0 + 0.35, z_top + 0.32, x1, y1 - 0.35, z_top + 0.62)
    n_roof_boxes = max(3, bay_count_long - 1)
    for ri in range(n_roof_boxes):
        ry = y0 + (ri + 0.5) * (length_y / n_roof_boxes)
        add_box(bm_pale, x0 + width_x * 0.34, ry - 1.5, z_top + 0.32, x0 + width_x * 0.66, ry + 1.5, z_top + 1.12)

    # Ground-floor private patio privacy wing walls along East & West long facades (matching h-8.jpg!)
    for di in range(1, bay_count_long + 1):
        dy = y0 + di * (length_y / (bay_count_long + 1))
        add_box(bm_ground, x0 - 2.4, dy - 0.12, z_base, x0 + G_IN, dy + 0.12, z_base + 2.15)
        add_box(bm_ground, x1 - G_IN, dy - 0.12, z_base, x1 + 2.4, dy + 0.12, z_base + 2.15)

    def add_j_curtain_y(side_y, out_dir, ax0, ax1, az0, az1, warm_lit=False, n_cols=2, hood=True):
        """Double-height framed curtain-wall bay on a short Y gable (zero z-fighting)."""
        if hood:
            hy0, hy1 = min(side_y, side_y + out_dir * 0.44), max(side_y, side_y + out_dir * 0.44)
            add_box(bm_hood, ax0 - 0.22, hy0, az1 - 0.05, ax1 + 0.22, hy1, az1 + 0.78)
            add_box(bm_hood, ax0 - 0.22, hy0, az0, ax0 + 0.04, hy1, az1)
            add_box(bm_hood, ax1 - 0.04, hy0, az0, ax1 + 0.22, hy1, az1)
        by0, by1 = min(side_y + out_dir * 0.015, side_y + out_dir * 0.035), max(side_y + out_dir * 0.015, side_y + out_dir * 0.035)
        gy0, gy1 = min(side_y + out_dir * 0.048, side_y + out_dir * 0.072), max(side_y + out_dir * 0.048, side_y + out_dir * 0.072)
        my0, my1 = min(side_y - out_dir * 0.01, side_y + out_dir * 0.105), max(side_y - out_dir * 0.01, side_y + out_dir * 0.105)
        target_b = bm_warm if warm_lit else bm_backing
        add_box(target_b, ax0 + 0.06, by0, az0 + 0.10, ax1 - 0.06, by1, az1 - 0.06)
        add_box(bm_glass, ax0 + 0.08, gy0, az0 + 0.12, ax1 - 0.08, gy1, az1 - 0.08)
        for ci in range(n_cols + 1):
            mx = ax0 + 0.07 + ci * ((ax1 - ax0 - 0.14) / n_cols)
            add_box(bm_mullion, mx - 0.035, my0, az0 + 0.08, mx + 0.035, my1, az1 - 0.04)
        for mz in (az0 + 0.10, az0 + 1.55, az0 + 2.90, az0 + 4.35, az1 - 0.06):
            add_box(bm_mullion, ax0 + 0.06, my0, mz - 0.04, ax1 - 0.06, my1, mz + 0.04)

    def add_j_curtain_x(side_x, out_dir, ay0, ay1, az0, az1, warm_lit=False, n_cols=3, hood=True):
        """Double-height framed curtain-wall bay on a long X facade (zero z-fighting)."""
        if hood:
            hx0, hx1 = min(side_x, side_x + out_dir * 0.44), max(side_x, side_x + out_dir * 0.44)
            add_box(bm_hood, hx0, ay0 - 0.22, az1 - 0.05, hx1, ay1 + 0.22, az1 + 0.78)
            add_box(bm_hood, hx0, ay0 - 0.22, az0, hx1, ay0 + 0.04, az1)
            add_box(bm_hood, hx0, ay1 - 0.04, az0, hx1, ay1 + 0.22, az1)
        bx0, bx1 = min(side_x + out_dir * 0.015, side_x + out_dir * 0.035), max(side_x + out_dir * 0.015, side_x + out_dir * 0.035)
        gx0, gx1 = min(side_x + out_dir * 0.048, side_x + out_dir * 0.072), max(side_x + out_dir * 0.048, side_x + out_dir * 0.072)
        mx0, mx1 = min(side_x - out_dir * 0.01, side_x + out_dir * 0.105), max(side_x - out_dir * 0.01, side_x + out_dir * 0.105)
        target_b = bm_warm if warm_lit else bm_backing
        add_box(target_b, bx0, ay0 + 0.06, az0 + 0.10, bx1, ay1 - 0.06, az1 - 0.06)
        add_box(bm_glass, gx0, ay0 + 0.08, az0 + 0.12, gx1, ay1 - 0.08, az1 - 0.08)
        for ci in range(n_cols + 1):
            my = ay0 + 0.07 + ci * ((ay1 - ay0 - 0.14) / n_cols)
            add_box(bm_mullion, mx0, my - 0.035, az0 + 0.08, mx1, my + 0.035, az1 - 0.04)
        for mz in (az0 + 0.10, az0 + 1.55, az0 + 2.90, az0 + 4.35, az1 - 0.06):
            add_box(bm_mullion, mx0, ay0 + 0.06, mz - 0.04, mx1, ay1 - 0.06, mz + 0.04)

    # 1. SHORT GABLE ENDS (South/SW y0 and North/NE y1 — matching mocire-zadar-h-8.jpg & v2-1.jpg!)
    for side_y, out_dir in ((y0, -1.0), (y1, 1.0)):
        # Two signature wrap-around corner double-height curtain-wall bays with olive hoods
        add_j_curtain_y(side_y, out_dir, x0, x0 + 2.8, z_d1, z_top, warm_lit=(out_dir > 0), n_cols=2, hood=True)
        add_j_curtain_y(side_y, out_dir, x1 - 2.8, x1, z_d1, z_top, warm_lit=(out_dir < 0), n_cols=2, hood=True)
        # Clean framed bedroom windows between the corner glass bays on upper 2 pale floors (matching h-8.jpg!)
        for fl_z in (z_d1 + 0.90, z_d1 + 3.70):
            for cx in (x0 + 6.0, x1 - 6.0):
                add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, cx, side_y, fl_z, fl_z + 1.55, 1.45, out_dir, shutter=True, warm_lit=False)
        # Clean framed vertical windows on middle 2 dark floors (matching h-8.jpg & v2-1.jpg!)
        for fl_z in (z_g1 + 0.85, z_g1 + 3.70):
            for cx, ww in ((x0 + 1.7, 1.35), (x0 + 5.6, 0.95), (x1 - 5.6, 0.95), (x1 - 1.7, 1.35)):
                add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, cx, side_y, fl_z, fl_z + 1.50, ww, out_dir, shutter=True, warm_lit=(ww > 1.2 and fl_z > z_g1 + 2.0))
        # Ground-floor framed windows mounted directly on the inset (+G_IN) plinth wall!
        g_face = y0 + G_IN if out_dir < 0 else y1 - G_IN
        for cx, ww in ((x0 + 1.9, 1.45), (x0 + 5.6, 0.95), (x1 - 5.6, 0.95), (x1 - 1.9, 1.45)):
            add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, cx, g_face, z_base + 0.15, z_g1 - 0.38, ww, out_dir, shutter=False, warm_lit=False)

    # 2. LONG FLANKS (West x0 and East x1 — matching mocire-zadar-h-8.jpg courtyard elevations!)
    step_y = length_y / bay_count_long
    for side_x, out_dir in ((x0, -1.0), (x1, 1.0)):
        g_face = x0 + G_IN if out_dir < 0 else x1 - G_IN
        for bi in range(bay_count_long):
            by_a = y0 + bi * step_y + 0.55
            by_b = by_a + min(4.2, step_y * 0.48)
            # Upper 2 pale floors: double-height hooded curtain-wall bay
            add_j_curtain_x(side_x, out_dir, by_a, by_b, z_d1, z_top, warm_lit=(bi % 2 == 1), n_cols=3, hood=True)
            # Gap between curtain bays: clean framed bedroom windows on both upper levels + balcony handrail
            gap_a = by_b + 0.45
            gap_b = y0 + (bi + 1) * step_y - 0.45
            if gap_b - gap_a > 1.8:
                gm = (gap_a + gap_b) * 0.5
                add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, side_x, gm - 1.1, gm + 1.1, z_d1 + 0.22, z_d1 + 2.50, out_dir, warm_lit=(bi % 3 == 0))
                add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, side_x, gm - 0.85, gm + 0.85, z_d1 + 3.65, z_top - 0.48, out_dir, warm_lit=False)
                rx0, rx1 = min(side_x + out_dir * 0.14, side_x + out_dir * 0.20), max(side_x + out_dir * 0.14, side_x + out_dir * 0.20)
                add_box(bm_mullion, rx0, gap_a, z_d1 + 1.00, rx1, gap_b, z_d1 + 1.06)
            # Middle 2 dark floors: clean framed loggia doors + side bedroom windows (zero overlap!)
            for fi, fl_z in enumerate((z_g1, z_g1 + 2.90)):
                add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, side_x, by_a + 0.35, by_b - 0.35, fl_z + 0.24, fl_z + 2.52, out_dir, warm_lit=((bi + fi) % 3 == 0))
                rx0, rx1 = min(side_x + out_dir * 0.14, side_x + out_dir * 0.20), max(side_x + out_dir * 0.14, side_x + out_dir * 0.20)
                add_box(bm_mullion, rx0, by_a + 0.25, fl_z + 1.02, rx1, by_b - 0.25, fl_z + 1.08)
                if gap_b - gap_a > 1.5:
                    gm = (gap_a + gap_b) * 0.5
                    add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, side_x, gm - 0.65, gm + 0.65, fl_z + 0.85, fl_z + 2.35, out_dir, warm_lit=False)
            # Ground floor: framed terrace doors mounted directly on the inset (+G_IN) plinth wall!
            add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, g_face, by_a + 0.35, by_b - 0.35, z_base + 0.16, z_g1 - 0.36, out_dir, warm_lit=(bi % 4 == 1))


def add_pitched_house_box(bm_wall, bm_roof, cx, cy, w, d, h_wall, h_roof=2.2, rot_rad=0.0, z0=-0.1):
    """Simple architectural Dalmatian house box with terracotta pitched roof (from aerial photos)."""
    cos_r, sin_r = math.cos(rot_rad), math.sin(rot_rad)

    def place_local(bm, verts_local, faces_idx):
        bverts = []
        for lx, ly, lz in verts_local:
            wx = cx + lx * cos_r - ly * sin_r
            wy = cy + lx * sin_r + ly * cos_r
            bverts.append(bm.verts.new((wx, wy, z0 + lz)))
        for f in faces_idx:
            bm.faces.new([bverts[i] for i in f])

    hw, hd = w * 0.5, d * 0.5
    # Wall box
    v_box = [
        (-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0),
        (-hw, -hd, h_wall), (hw, -hd, h_wall), (hw, hd, h_wall), (-hw, hd, h_wall),
    ]
    f_box = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
    ]
    place_local(bm_wall, v_box, f_box)

    # Pitched gable roof with subtle overhang
    ow, od = hw + 0.45, hd + 0.45
    v_roof = [
        (-ow, -od, h_wall), (ow, -od, h_wall), (ow, od, h_wall), (-ow, od, h_wall),
        (-ow, 0.0, h_wall + h_roof), (ow, 0.0, h_wall + h_roof),
    ]
    f_roof = [
        (0, 1, 5, 4), (2, 3, 4, 5),
        (0, 4, 3), (1, 2, 5),
        (0, 3, 2, 1),
    ]
    place_local(bm_roof, v_roof, f_roof)


def add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, cx, y_face, z0, z1, width, out_dir, shutter=True, warm_lit=False):
    hw = width * 0.5
    by0, by1 = y_face + out_dir * 0.025, y_face + out_dir * 0.005
    target_back = bm_warm if warm_lit else bm_backing
    add_box(target_back, cx - hw, min(by0, by1), z0, cx + hw, max(by0, by1), z1)

    gy0, gy1 = y_face + out_dir * 0.055, y_face + out_dir * 0.035
    add_box(bm_glass, cx - hw + 0.03, min(gy0, gy1), z0 + 0.03, cx + hw - 0.03, max(gy0, gy1), z1 - 0.03)

    fy0, fy1 = y_face + out_dir * 0.095, y_face - out_dir * 0.01
    fmin, fmax = min(fy0, fy1), max(fy0, fy1)
    ft = 0.07
    add_box(bm_mullion, cx - hw - ft, fmin, z0, cx - hw, fmax, z1)
    add_box(bm_mullion, cx + hw, fmin, z0, cx + hw + ft, fmax, z1)
    add_box(bm_mullion, cx - hw - ft, fmin, z1, cx + hw + ft, fmax, z1 + (0.22 if shutter else 0.09))
    add_box(bm_mullion, cx - hw - ft, fmin, z0 - 0.05, cx + hw + ft, fmax, z0)
    if width >= 1.12:
        add_box(bm_mullion, cx - 0.025, min(gy0, gy1) - 0.01, z0, cx + 0.025, max(gy0, gy1) + 0.01, z1)

    sy0, sy1 = y_face + out_dir * 0.14, y_face - out_dir * 0.02
    add_box(bm_sill, cx - hw - 0.09, min(sy0, sy1), z0 - 0.09, cx + hw + 0.09, max(sy0, sy1), z0 - 0.03)


def add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, ex_face, wy0, wy1, z0, z1, edir, warm_lit=False):
    target_back = bm_warm if warm_lit else bm_backing
    gx0, gx1 = ex_face + edir * 0.055, ex_face + edir * 0.035
    bx0, bx1 = ex_face + edir * 0.025, ex_face + edir * 0.005
    fx0, fx1 = ex_face + edir * 0.095, ex_face - edir * 0.01
    sx0, sx1 = ex_face + edir * 0.135, ex_face - edir * 0.02
    add_box(target_back, min(bx0, bx1), wy0, z0, max(bx0, bx1), wy1, z1)
    add_box(bm_glass, min(gx0, gx1), wy0 + 0.03, z0 + 0.03, max(gx0, gx1), wy1 - 0.03, z1 - 0.03)
    add_box(bm_mullion, min(fx0, fx1), wy0 - 0.06, z1, max(fx0, fx1), wy1 + 0.06, z1 + 0.20)
    add_box(bm_mullion, min(fx0, fx1), wy0 - 0.06, z0, max(fx0, fx1), wy0, z1)
    add_box(bm_mullion, min(fx0, fx1), wy1, z0, max(fx0, fx1), wy1 + 0.06, z1)
    if (wy1 - wy0) >= 1.05:
        ym = (wy0 + wy1) * 0.5
        add_box(bm_mullion, min(gx0, gx1) - 0.01, ym - 0.025, z0, max(gx0, gx1) + 0.01, ym + 0.025, z1)
    add_box(bm_sill, min(sx0, sx1), wy0 - 0.09, z0 - 0.09, max(sx0, sx1), wy1 + 0.09, z0 - 0.03)


def add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, x0, x1, y_wall, z0, z1, out_dir, warm_lit=False):
    margin = 0.14
    dx0, dx1 = x0 + margin, x1 - margin
    if dx1 - dx0 < 0.7:
        return
    dz0, dz1 = z0 + 0.24, z1 - 0.28
    by0, by1 = y_wall + out_dir * 0.03, y_wall + out_dir * 0.005
    gy0, gy1 = y_wall + out_dir * 0.06, y_wall + out_dir * 0.035
    fy0, fy1 = y_wall + out_dir * 0.09, y_wall - out_dir * 0.01
    target_back = bm_warm if warm_lit else bm_backing
    add_box(target_back, dx0, min(by0, by1), dz0, dx1, max(by0, by1), dz1)
    add_box(bm_glass, dx0 + 0.04, min(gy0, gy1), dz0 + 0.04, dx1 - 0.04, max(gy0, gy1), dz1 - 0.04)
    add_box(bm_mullion, dx0, min(fy0, fy1), dz0, dx0 + 0.06, max(fy0, fy1), dz1)
    add_box(bm_mullion, dx1 - 0.06, min(fy0, fy1), dz0, dx1, max(fy0, fy1), dz1)
    add_box(bm_mullion, dx0, min(fy0, fy1), dz1, dx1, max(fy0, fy1), dz1 + 0.18)
    mid = (dx0 + dx1) * 0.5
    add_box(bm_mullion, mid - 0.03, min(fy0, fy1), dz0, mid + 0.03, max(fy0, fy1), dz1)


def add_trapezoid_hood(bm_hood, bm_mullion, x0, x1, y_face, z0, z1, proj, side):
    flare_x = 0.24
    dir_y = -1.0 if side == "south" else 1.0
    y_out = y_face + dir_y * proj
    ymin, ymax = min(y_face, y_out), max(y_face, y_out)
    top_h = 0.85
    add_box(bm_hood, x0 - flare_x, ymin, z1 - 0.05, x1 + flare_x, ymax, z1 + top_h)
    add_box(bm_mullion, x0 - flare_x - 0.03, ymin - 0.02, z1 + top_h, x1 + flare_x + 0.03, ymax + 0.02, z1 + top_h + 0.06)
    fin_w = 0.24
    add_box(bm_hood, x0 - fin_w, ymin, z0, x0 + 0.06, ymax, z1)
    add_box(bm_hood, x1 - 0.06, ymin, z0, x1 + fin_w, ymax, z1)


def main():
    calib = json.load(open(CALIB_PATH, encoding="utf-8"))
    bldg = calib["building_m"]
    W = bldg["width_x"]
    D = bldg["depth_y"]
    CORR_Y0, CORR_Y1 = bldg["corridor_y"]
    CORE_X0, CORE_X1 = bldg["core_x"]
    floors = calib["floors"]
    units = calib["units"]

    clear_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"

    mats = {
        "ground_plaster": make_pbr_mat("Mocire_Ground_Plaster", (0.87, 0.85, 0.81), "ground_plaster_albedo.jpg", "ground_plaster_rough.jpg", "ground_plaster_normal.jpg", 0.35, 0.84),
        "dark_plaster": make_pbr_mat("Mocire_Dark_Plaster", (0.35, 0.33, 0.31), "dark_plaster_albedo.jpg", "dark_plaster_rough.jpg", "dark_plaster_normal.jpg", 0.45, 0.82),
        "pale_plaster": make_pbr_mat("Mocire_Pale_Plaster", (0.70, 0.66, 0.61), "pale_plaster_albedo.jpg", "pale_plaster_rough.jpg", "pale_plaster_normal.jpg", 0.40, 0.80),
        "olive_hood": make_pbr_mat("Mocire_Olive_Hood", (0.50, 0.48, 0.38), "olive_hood_albedo.jpg", "olive_hood_rough.jpg", "olive_hood_normal.jpg", 0.35, 0.65),
        "glass": make_pbr_mat("Mocire_Glass", (0.50, 0.62, 0.72), roughness=0.04, metallic=0.32),
        "glass_backing": make_pbr_mat("Mocire_Glass_Interior", (0.06, 0.07, 0.09), roughness=0.92),
        "warm_interior": make_pbr_mat("Mocire_Warm_Interior", (0.96, 0.78, 0.52), roughness=0.85, emission_rgba=(1.0, 0.74, 0.42), emission_strength=1.35),
        "lantern_glow": make_pbr_mat("Mocire_Lantern_Glow", (1.0, 0.82, 0.52), roughness=0.25, emission_rgba=(1.0, 0.76, 0.38), emission_strength=3.2),
        "mullion": make_pbr_mat("Mocire_Mullion", (0.11, 0.12, 0.13), roughness=0.34, metallic=0.58),
        "sill": make_pbr_mat("Mocire_Sill", (0.77, 0.75, 0.72), roughness=0.62, metallic=0.12),
        "concrete": make_pbr_mat("Mocire_Concrete", (0.66, 0.65, 0.62), roughness=0.84),
        "interior_floor": make_pbr_mat("Mocire_Interior_Floor", (0.92, 0.90, 0.86), roughness=0.72),
        "interior_wall": make_pbr_mat("Mocire_Interior_Wall", (0.19, 0.18, 0.17), roughness=0.78),
        "corridor_tile": make_pbr_mat("Mocire_Corridor_Tile", (0.82, 0.81, 0.79), roughness=0.65),
        "stone_wall": make_pbr_mat("Mocire_Stone_Wall", (0.72, 0.70, 0.67), "stone_wall_albedo.jpg", "stone_wall_rough.jpg", "stone_wall_normal.jpg", 1.15, 0.88),
        "grass_paver": make_pbr_mat("Mocire_Grass_Paver", (0.52, 0.58, 0.42), "grass_paver_albedo.jpg", None, "grass_paver_normal.jpg", 0.75, 0.86),
        "asphalt": make_pbr_mat("Mocire_Asphalt", (0.38, 0.39, 0.41), "asphalt_albedo.jpg", "asphalt_rough.jpg", "asphalt_normal.jpg", 0.55, 0.86),
        "road_paint": make_pbr_mat("Mocire_Road_Paint", (0.94, 0.94, 0.92), roughness=0.72),
        "yellow_paint": make_pbr_mat("Mocire_Yellow_Paint", (0.88, 0.72, 0.18), roughness=0.72),
        "lawn": make_pbr_mat("Mocire_Lawn", (0.35, 0.46, 0.21), "lawn_albedo.jpg", "lawn_rough.jpg", "lawn_normal.jpg", 0.65, 0.94),
        "mulch": make_pbr_mat("Mocire_Mulch", (0.30, 0.23, 0.18), roughness=0.95),
        "terrace_tile": make_pbr_mat("Mocire_Terrace_Tile", (0.81, 0.79, 0.75), "terrace_albedo.jpg", None, "terrace_normal.jpg", 0.55, 0.76),
        "roof_gravel": make_pbr_mat("Mocire_Roof", (0.48, 0.47, 0.45), "asphalt_albedo.jpg", None, "asphalt_normal.jpg", 0.45, 0.94),
        "foliage_dark": make_pbr_mat("Mocire_Foliage_Dark", (0.19, 0.35, 0.13), roughness=0.84),
        "foliage_light": make_pbr_mat("Mocire_Foliage_Light", (0.32, 0.50, 0.18), roughness=0.80),
        "cypress_green": make_pbr_mat("Mocire_Cypress", (0.13, 0.27, 0.12), roughness=0.86),
        "tree_trunk": make_pbr_mat("Mocire_Trunk", (0.25, 0.19, 0.14), roughness=0.92),
        "car_dark": make_pbr_mat("Mocire_Car_Dark", (0.14, 0.15, 0.17), roughness=0.18, metallic=0.72),
        "car_silver": make_pbr_mat("Mocire_Car_Silver", (0.72, 0.74, 0.76), roughness=0.20, metallic=0.78),
        "car_white": make_pbr_mat("Mocire_Car_White", (0.90, 0.90, 0.89), roughness=0.22, metallic=0.25),
        "car_wheel": make_pbr_mat("Mocire_Car_Wheel", (0.08, 0.08, 0.09), roughness=0.82),
        "house_cream": make_pbr_mat("Mocire_House_Cream", (0.86, 0.82, 0.76), roughness=0.88),
        "house_white": make_pbr_mat("Mocire_House_White", (0.91, 0.90, 0.88), roughness=0.84),
        "house_grey": make_pbr_mat("Mocire_House_Grey", (0.72, 0.74, 0.76), roughness=0.82),
        "roof_terracotta": make_pbr_mat("Mocire_Roof_Terracotta", (0.64, 0.31, 0.20), roughness=0.82),
        "hall_cream": make_pbr_mat("Mocire_Hall_Cream", (0.80, 0.76, 0.64), roughness=0.82),
    }

    builder = Builder(scene)

    # ------------------------------------------------------------------
    # 1. REAL MOČIRE ZADAR SURROUNDINGS + J1 & J2 + AERIAL HOUSE BOXES
    # Verified directly against Sigma July 2025 drone photo (mocire-zadar-h-v2-1.jpg)
    # and J1/J2 aerial composites (Mocire_J-Zadar-0036..0047):
    # - Building H long axis runs NW–SE (X=0..64.8), South/SW facade (Y=0) faces the street
    # - J1 (shorter SE twin, 40m) & J2 (longer NW twin, 54m) stand directly SOUTH/SW across
    #   the front perimeter road, oriented perpendicular (NE–SW along Y)
    # - Grey-white commercial complex stands immediately SE of J1 (right foreground of drone photo)
    # - Twin 6-story white apartments stand SE/East of Building H
    # - Dense Mediterranean pine woodland + sea of terracotta-roofed houses sit North/NE behind H
    # ------------------------------------------------------------------
    # Vast Mediterranean ground plane so horizon melts smoothly into golden-hour fog (no visible edges)
    bm = bmesh.new()
    add_box(bm, -420.0, -360.0, -0.60, W + 400.0, D + 360.0, -0.20)
    builder.add_mesh("B00", "L00", "NONE", "site", bm, mats["lawn"], "SITE", uv_tile=36.0, confidence=0.4)

    # Paved approach road (Ulica Asje Petričić between H and J1/J2), side streets, and J1/J2 plaza
    bm = bmesh.new()
    add_box(bm, -32.0, -35.0, -0.20, W + 34.0, -5.0, -0.02)
    add_box(bm, -18.0, -5.0, -0.19, W + 18.0, D + 14.0, -0.05)
    # Main NW–SE perimeter road separating Building H (NE) from J2 & J1 (SW)
    add_box(bm, -260.0, -35.0, -0.20, W + 240.0, -23.0, -0.03)
    # Pedestrian promenade running along Building H's North side & flanking West/East
    add_box(bm, -120.0, D + 8.0, -0.19, W + 120.0, D + 13.5, -0.04)
    add_box(bm, -12.0, -104.0, -0.20, -4.0, -23.0, -0.04)
    add_box(bm, 64.0, -104.0, -0.20, 72.0, -23.0, -0.03)
    add_box(bm, W + 14.0, -35.0, -0.20, W + 23.0, D + 65.0, -0.03)
    # J2 & J1 shared central courtyard plaza + SW surface parking court (exact match to mocire-zadar-h-1 & h-8!)
    add_box(bm, -4.0, -98.0, -0.19, 64.0, -35.0, -0.04)
    builder.add_mesh("B00", "L00", "NONE", "site", bm, mats["asphalt"], "SITE", uv_tile=10.0, confidence=0.5)

    # Permeable grass-grid parking bays (travne rešetke, iconic in Mocire_H-Zadar_006 & _007!)
    bm_gp = bmesh.new()
    add_box(bm_gp, -4.0, -15.8, -0.025, CORE_X0 - 2.6, -10.4, 0.002)
    add_box(bm_gp, CORE_X1 + 2.6, -15.8, -0.025, W + 4.0, -10.4, 0.002)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_gp, mats["grass_paver"], "SITE", uv_tile=2.2, confidence=0.55)

    # Crisp white parking bay stripes + yellow turnaround hatch (_005, _006, _007)
    bm_paint = bmesh.new()
    for px in range(-4, int(W) + 5, 3):
        if CORE_X0 - 2.6 < px < CORE_X1 + 2.6:
            continue
        add_box(bm_paint, px - 0.06, -15.8, 0.002, px + 0.06, -10.4, 0.012)
    add_box(bm_paint, -4.0, -15.8, 0.002, CORE_X0 - 2.6, -15.68, 0.012)
    add_box(bm_paint, CORE_X1 + 2.6, -15.8, 0.002, W + 4.0, -15.68, 0.012)
    for rx in range(-90, int(W) + 90, 9):
        add_box(bm_paint, rx, -29.6, -0.025, rx + 4.0, -29.45, -0.012)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_paint, mats["road_paint"], "SITE", uv_tile=4.0, confidence=0.4)

    # Yellow drop-off zone stripes on SE approach island (matching Mocire_H-Zadar_005!)
    bm_yp = bmesh.new()
    for yx in range(44, 56, 2):
        add_box(bm_yp, yx, -21.2, -0.015, yx + 0.6, -18.2, -0.004)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_yp, mats["yellow_paint"], "SITE", uv_tile=2.0, confidence=0.35)

    # Concrete sidewalks, kerbs & pedestrian promenades
    bm_kerb = bmesh.new()
    add_box(bm_kerb, -32.0, -23.0, -0.05, W + 34.0, -21.0, 0.10)
    add_box(bm_kerb, -12.0, -10.4, -0.04, CORE_X0 - 2.2, -9.7, 0.10)
    add_box(bm_kerb, CORE_X1 + 2.2, -10.4, -0.04, W + 12.0, -9.7, 0.10)
    add_box(bm_kerb, -18.0, D + 5.2, -0.05, W + 18.0, D + 7.8, 0.08)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_kerb, mats["concrete"], "SITE", uv_tile=4.0, confidence=0.45)

    # L00 Ground-floor Private Terraces (exact tiled depths from floor-prizemlje.png)
    bm_terr = bmesh.new()
    add_box(bm_terr, 0.0, -4.85, -0.05, W, 0.0, 0.04)
    add_box(bm_terr, 0.0, D, -0.05, W, D + 3.60, 0.04)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_terr, mats["terrace_tile"], "SITE", uv_tile=3.0, confidence=0.7)

    # L00 Corner Private Gardens (Vrt) & North planter beds
    bm_gardens = bmesh.new()
    add_box(bm_gardens, -5.2, -4.85, -0.05, 0.0, D + 3.60, 0.03)
    add_box(bm_gardens, W, -4.85, -0.05, W + 6.4, D + 3.60, 0.03)
    add_box(bm_gardens, 0.0, D + 3.60, -0.05, W, D + 4.75, 0.05)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_gardens, mats["lawn"], "SITE", uv_tile=6.0, confidence=0.65)

    # Mulched Mediterranean planter beds (SE sloped landscaped beds seen in Mocire_H-Zadar_001!)
    bm_mulch = bmesh.new()
    add_box(bm_mulch, 2.2, -9.7, 0.05, CORE_X0 - 3.2, -6.9, 0.50)
    add_box(bm_mulch, CORE_X1 + 3.2, -9.7, 0.05, W - 2.2, -6.9, 0.50)
    add_box(bm_mulch, W + 1.5, -18.5, 0.02, W + 13.5, -7.2, 0.42)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_mulch, mats["mulch"], "SITE", uv_tile=4.0, confidence=0.45)

    # Terraced Dalmatian dry-stone retaining walls + coping caps (_000, _001, _005, _006)
    bm_stone = bmesh.new()
    bm_cap = bmesh.new()
    stone_walls = [
        # Main terrace enclosure wall
        (-5.2, -5.30, -0.18, CORE_X0 - 0.55, -4.82, 1.18),
        (CORE_X1 + 0.55, -5.30, -0.18, W + 6.4, -4.82, 1.18),
        (-5.2, D + 4.75, -0.18, W + 6.4, D + 5.20, 1.05),
        (-5.65, -5.30, -0.18, -5.20, D + 5.20, 1.05),
        (W + 6.40, -5.30, -0.18, W + 6.85, D + 5.20, 1.05),
        # Entrance stair & ramp retaining cheeks
        (CORE_X0 - 0.72, -5.35, -0.18, CORE_X0 - 0.25, 0.0, 1.38),
        (CORE_X1 + 0.25, -5.35, -0.18, CORE_X1 + 0.72, 0.0, 1.38),
        # Parking court stone planter borders
        (2.0, -9.9, -0.05, CORE_X0 - 3.0, -6.7, 0.54),
        (CORE_X1 + 3.0, -9.9, -0.05, W - 2.0, -6.7, 0.54),
        # Stepped SE landscaped stone terraces (iconic foreground of Mocire_H-Zadar_001!)
        (W + 1.2, -19.0, -0.15, W + 13.8, -18.5, 0.75),
        (W + 13.3, -19.0, -0.15, W + 13.8, -6.8, 0.85),
        (-16.5, -18.5, -0.15, -6.5, -18.0, 0.72),
    ]
    for wx0, wy0, wz0, wx1, wy1, wz1 in stone_walls:
        add_box(bm_stone, wx0, wy0, wz0, wx1, wy1, wz1)
        add_box(bm_cap, wx0 - 0.04, wy0 - 0.04, wz1, wx1 + 0.04, wy1 + 0.04, wz1 + 0.08)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_stone, mats["stone_wall"], "SITE", uv_tile=2.4, confidence=0.65)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_cap, mats["concrete"], "SITE", uv_tile=3.0, confidence=0.55)

    # Courtyard dark steel picket fence
    bm_fence = bmesh.new()
    for fx0, fx1, fy, fz in (
        (-5.2, CORE_X0 - 0.7, -5.06, 1.26),
        (CORE_X1 + 0.7, W + 6.4, -5.06, 1.26),
        (-5.2, W + 6.4, D + 4.98, 1.13),
    ):
        add_box(bm_fence, fx0, fy - 0.025, fz + 0.62, fx1, fy + 0.025, fz + 0.67)
        add_box(bm_fence, fx0, fy - 0.025, fz + 0.08, fx1, fy + 0.025, fz + 0.12)
        px = fx0
        while px <= fx1:
            add_box(bm_fence, px - 0.02, fy - 0.02, fz, px + 0.02, fy + 0.02, fz + 0.65)
            px += 0.90
    builder.add_mesh("B00", "L00", "NONE", "site", bm_fence, mats["mullion"], "SITE", uv_tile=2.0, confidence=0.5)

    # Entrance stairs (left) + accessibility ramp (right)
    bm_stair = bmesh.new()
    mid_core = CORE_X0 + (CORE_X1 - CORE_X0) * 0.62
    for step in range(8):
        sy0 = -4.9 + step * 0.42
        add_box(bm_stair, CORE_X0 - 0.25, sy0, -0.05, mid_core, sy0 + 0.42, -0.05 + (step + 1) * 0.04)
    add_box(bm_stair, mid_core, -4.9, -0.05, CORE_X1 + 0.25, -1.5, 0.16)
    add_box(bm_stair, CORE_X0 - 0.25, -1.55, -0.05, CORE_X1 + 0.25, 0.0, 0.27)
    builder.add_mesh("B00", "L00", "NONE", "stair", bm_stair, mats["concrete"], "SITE", uv_tile=3.0, confidence=0.6)

    # Warm golden-hour modern courtyard bollard lamps along approach & entrance
    bm_posts = bmesh.new()
    bm_lamps = bmesh.new()
    lamp_coords = [
        (CORE_X0 - 1.2, -5.8), (CORE_X1 + 1.2, -5.8),
        (CORE_X0 - 1.2, -10.2), (CORE_X1 + 1.2, -10.2),
        (10.0, -21.8), (24.0, -21.8), (40.0, -21.8), (54.0, -21.8),
        (10.0, D + 6.5), (32.0, D + 6.5), (54.0, D + 6.5),
    ]
    for lx, ly in lamp_coords:
        tall = ly < -18.0 or ly > D + 5.0
        h_p = 4.2 if tall else 1.05
        add_box(bm_posts, lx - 0.06, ly - 0.06, 0.0, lx + 0.06, ly + 0.06, h_p)
        add_box(bm_lamps, lx - 0.11, ly - 0.11, h_p, lx + 0.11, ly + 0.11, h_p + (0.28 if tall else 0.18))
    builder.add_mesh("B00", "L00", "NONE", "site", bm_posts, mats["mullion"], "SITE", uv_tile=2.0, confidence=0.4)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_lamps, mats["lantern_glow"], "SITE", uv_tile=1.0, confidence=0.4)

    # Note: Pre-made CC0 3D trees, shrubs, and cars are instanced directly in Three.js via CC0SiteProps.tsx
    # Keep slender background Dalmatian cypress silhouettes on the distant horizon only
    bm_trunks = bmesh.new()
    bm_cypress = bmesh.new()
    for cx, cy, ch in (
        (-102.0, -18.0, 9.2), (-106.0, 12.0, 8.6), (-100.0, 48.0, 9.4),
        (W + 34.0, -18.0, 8.8), (W + 38.0, 14.0, 8.2), (W + 34.0, 42.0, 9.2),
        (-12.0, D + 42.0, 8.6), (32.0, D + 48.0, 9.0), (W + 18.0, D + 40.0, 8.8),
    ):
        add_cypress_tree(bm_trunks, bm_cypress, cx, cy, bz=0.0, height=ch)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_trunks, mats["tree_trunk"], "SITE", uv_tile=2.0, confidence=0.35, smooth=True)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_cypress, mats["cypress_green"], "SITE", uv_tile=3.0, confidence=0.35, smooth=True)

    # ------------------------------------------------------------------
    # 1B. MOČIRE ZADAR J1 & J2 (100% EXACT IRL LAYOUT FROM CONSTRUCTION PHOTOS h-1, h-8, v2-4!)
    # Verified directly from Sigma's Building H construction drone photos:
    # - Building H (X=0..64.8) spans symmetrically directly behind J2 + courtyard + J1!
    # - J2 (longer NW twin, 18m x 54m): X=1..19, Y=-90..-36 (aligned with Building H's NW/left end)
    # - Shared central courtyard plaza (24m wide): X=19..43 (aimed straight at Building H's center!)
    # - J1 (shorter SE twin, 18m x 40m): X=43..61, Y=-76..-36 (aligned with Building H's SE/right end)
    # ------------------------------------------------------------------
    bm_j_ground = bmesh.new()
    bm_j_dark = bmesh.new()
    bm_j_pale = bmesh.new()
    bm_j_hood = bmesh.new()
    bm_j_glass = bmesh.new()
    bm_j_back = bmesh.new()
    bm_j_warm = bmesh.new()
    bm_j_mull = bmesh.new()
    bm_j_sill = bmesh.new()
    bm_j_roof = bmesh.new()
    bm_j_stone = bmesh.new()

    # J2 (longer NW twin directly across the street from Building H's left/NW side: 18m x 54m)
    add_j_building(
        bm_j_ground, bm_j_dark, bm_j_pale, bm_j_hood, bm_j_glass, bm_j_back, bm_j_warm, bm_j_mull, bm_j_sill, bm_j_roof,
        x0=1.0, y0=-90.0, width_x=18.0, length_y=54.0, bay_count_long=5, z_base=0.0,
    )
    # J1 (shorter SE twin parallel across the 24m central courtyard: 18m x 40m)
    add_j_building(
        bm_j_ground, bm_j_dark, bm_j_pale, bm_j_hood, bm_j_glass, bm_j_back, bm_j_warm, bm_j_mull, bm_j_sill, bm_j_roof,
        x0=43.0, y0=-76.0, width_x=18.0, length_y=40.0, bay_count_long=4, z_base=0.0,
    )
    # Stone perimeter retaining walls & central courtyard planter island (exact match to mocire-zadar-h-8.jpg!)
    add_box(bm_j_stone, -2.5, -93.5, -0.18, 22.5, -93.0, 1.15)
    add_box(bm_j_stone, -2.5, -93.5, -0.18, -2.0, -34.5, 1.15)
    add_box(bm_j_stone, -2.5, -35.0, -0.18, 22.5, -34.5, 1.15)
    add_box(bm_j_stone, 39.5, -79.5, -0.18, 64.5, -79.0, 1.15)
    add_box(bm_j_stone, 64.0, -79.5, -0.18, 64.5, -34.5, 1.15)
    add_box(bm_j_stone, 39.5, -35.0, -0.18, 64.5, -34.5, 1.15)
    # Central courtyard pedestrian strip + raised planter islands (seen straight down the center in h-8.jpg!)
    add_box(bm_j_stone, 28.5, -74.0, -0.05, 33.0, -52.0, 0.58)
    # Crisp white parking bay stripes in the SW parking lot south of J1 (matching h-8.jpg bays 1..29!)
    bm_j_stripes = bmesh.new()
    for sx in range(40, 62, 3):
        add_box(bm_j_stripes, sx - 0.05, -86.5, -0.035, sx + 0.05, -81.0, -0.024)
        add_box(bm_j_stripes, sx - 0.05, -96.5, -0.035, sx + 0.05, -91.0, -0.024)
    builder.add_mesh("B02", "L00", "NONE", "site", bm_j_stripes, mats["road_paint"], "MOČIRE_J1_J2", uv_tile=4.0, confidence=0.7)

    builder.add_mesh("B02", "L00", "NONE", "wall", bm_j_ground, mats["ground_plaster"], "MOČIRE_J1_J2", uv_tile=5.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "wall", bm_j_dark, mats["dark_plaster"], "MOČIRE_J1_J2", uv_tile=5.5, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "wall", bm_j_pale, mats["pale_plaster"], "MOČIRE_J1_J2", uv_tile=5.5, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "roof", bm_j_hood, mats["olive_hood"], "MOČIRE_J1_J2", uv_tile=4.5, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "window", bm_j_back, mats["glass_backing"], "MOČIRE_J1_J2", uv_tile=2.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "window", bm_j_warm, mats["warm_interior"], "MOČIRE_J1_J2", uv_tile=2.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "window", bm_j_glass, mats["glass"], "MOČIRE_J1_J2", uv_tile=2.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "window", bm_j_mull, mats["mullion"], "MOČIRE_J1_J2", uv_tile=2.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "window", bm_j_sill, mats["sill"], "MOČIRE_J1_J2", uv_tile=2.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "roof", bm_j_roof, mats["roof_gravel"], "MOČIRE_J1_J2", uv_tile=5.0, confidence=0.8)
    builder.add_mesh("B02", "L00", "NONE", "site", bm_j_stone, mats["stone_wall"], "MOČIRE_J1_J2", uv_tile=2.5, confidence=0.8)

    # ------------------------------------------------------------------
    # 1C. SURROUNDING NEIGHBORHOOD BOXES FROM AERIAL PHOTOS (mocire-zadar-h-1.jpg & 0042)
    # Exact compass layout verified directly from mocire-zadar-h-1.jpg:
    # - Long grey-white commercial/school complex immediately SE/East of J1 (X=74..136, Y=-94..-38)
    # - Twin 5–6 story white apartment boxes immediately East/SE of Building H (X=W+26..W+86, Y=-18..+14)
    # - Large cream gabled industrial hall NW/West of J2 (X=-56..-18, Y=-96..-64, seen far right of h-1.jpg!)
    # - Dalmatian terracotta-roofed houses: SW beyond J1/J2 (toward sea) & North behind H's pine belt
    # ------------------------------------------------------------------
    bm_h_cream = bmesh.new()
    bm_h_white = bmesh.new()
    bm_h_grey = bmesh.new()
    bm_h_roof = bmesh.new()
    bm_hall = bmesh.new()

    # Long commercial/school complex immediately SE/East of J1 across the side street (h-1.jpg middle-left & v2-6 left!)
    add_box(bm_h_white, 74.0, -56.0, -0.1, 108.0, -38.0, 7.6)
    add_box(bm_h_grey, 76.0, -96.0, -0.1, 138.0, -64.0, 8.6)
    add_box(bm_h_white, 112.0, -60.0, -0.1, 138.0, -40.0, 7.2)

    # Twin white modern 5–6 story apartment boxes East/SE of Building H (h-1.jpg bottom-left & v2-4 right!)
    add_box(bm_h_white, W + 26.0, -16.0, -0.1, W + 50.0, 6.0, 17.5)
    add_box(bm_h_white, W + 58.0, -14.0, -0.1, W + 82.0, 8.0, 17.5)

    # Large beige/cream gabled industrial hall NW/West of J2 (clearly visible on far right of mocire-zadar-h-1.jpg!)
    add_pitched_house_box(bm_hall, bm_h_grey, -38.0, -82.0, 36.0, 22.0, 8.2, h_roof=2.6, rot_rad=0.06)

    # Surrounding Dalmatian residential house boxes with terracotta roofs (from mocire-zadar-h-1.jpg & 0042)
    houses = [
        # Seaward / SW cluster directly beyond J2 & J1 toward the coast (background of h-1.jpg & foreground of 0042)
        (-16.0, -118.0, 12.5, 10.0, 7.4, 0.04, bm_h_cream),
        (6.0, -120.0, 11.5, 9.5, 6.8, -0.03, bm_h_white),
        (28.0, -118.0, 13.0, 10.5, 7.8, 0.02, bm_h_cream),
        (50.0, -116.0, 12.0, 9.5, 7.2, -0.05, bm_h_white),
        (74.0, -122.0, 12.5, 10.0, 7.5, 0.03, bm_h_cream),
        (-4.0, -142.0, 13.5, 10.0, 8.0, 0.04, bm_h_white),
        (22.0, -144.0, 12.0, 9.5, 7.2, -0.03, bm_h_cream),
        (46.0, -140.0, 13.0, 10.5, 7.6, 0.05, bm_h_white),
        # Inland / North-NE residential neighborhood behind Building H's pine belt (background of v2-1 & v2-4)
        (-42.0, D + 56.0, 13.0, 10.0, 7.6, 0.05, bm_h_cream),
        (-18.0, D + 60.0, 12.0, 9.5, 7.0, -0.04, bm_h_white),
        (6.0, D + 58.0, 13.5, 10.5, 7.8, 0.02, bm_h_cream),
        (30.0, D + 62.0, 12.5, 9.5, 7.2, -0.03, bm_h_white),
        (54.0, D + 58.0, 14.0, 10.5, 8.0, 0.04, bm_h_cream),
        (78.0, D + 56.0, 12.5, 10.0, 7.4, -0.05, bm_h_white),
        (-30.0, D + 82.0, 12.5, 10.0, 7.2, 0.03, bm_h_white),
        (-4.0, D + 84.0, 13.5, 10.0, 7.8, -0.02, bm_h_cream),
        (22.0, D + 86.0, 12.0, 9.5, 7.0, 0.04, bm_h_white),
        (48.0, D + 82.0, 13.0, 10.5, 7.6, -0.04, bm_h_cream),
        (74.0, D + 80.0, 12.5, 9.5, 7.4, 0.02, bm_h_white),
        # Scattered houses NW across the green meadow & East beyond the twin apartments
        (-74.0, -48.0, 12.5, 10.0, 7.4, 0.05, bm_h_cream),
        (-78.0, -14.0, 13.0, 9.5, 7.0, -0.04, bm_h_white),
        (-72.0, 26.0, 13.5, 10.5, 7.8, 0.02, bm_h_cream),
        (W + 38.0, 30.0, 13.0, 10.0, 7.6, -0.03, bm_h_cream),
        (W + 64.0, 26.0, 12.5, 9.5, 7.2, 0.04, bm_h_white),
    ]
    for hx, hy, hw, hd, hh, hrot, target_bm in houses:
        add_pitched_house_box(target_bm, bm_h_roof, hx, hy, hw, hd, hh, h_roof=2.2, rot_rad=hrot)

    builder.add_mesh("B00", "L00", "NONE", "site", bm_h_cream, mats["house_cream"], "NEIGHBORHOOD", uv_tile=5.0, confidence=0.4)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_h_white, mats["house_white"], "NEIGHBORHOOD", uv_tile=5.0, confidence=0.4)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_h_grey, mats["house_grey"], "NEIGHBORHOOD", uv_tile=6.0, confidence=0.4)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_h_roof, mats["roof_terracotta"], "NEIGHBORHOOD", uv_tile=4.0, confidence=0.4)
    builder.add_mesh("B00", "L00", "NONE", "site", bm_hall, mats["hall_cream"], "NEIGHBORHOOD", uv_tile=6.0, confidence=0.4)

    # ------------------------------------------------------------------
    # 2. 1:1 FLOORPLAN-EXACT MOČIRE ZADAR H BUILDING
    # ------------------------------------------------------------------
    units_by_floor = {lvl: [u for u in units if u["floor_id"] == lvl] for lvl in floors}
    WALL_T = 0.28
    PART_T = 0.16
    SLAB_T = 0.24

    for lvl in ("L00", "L01", "L02", "L03", "L04"):
        band = floors[lvl]
        z0 = band["z0"]
        z1 = band["z1"]
        col_name = f"B01_{lvl}"
        floor_units = units_by_floor[lvl]

        if lvl == "L00":
            ext_mat = mats["ground_plaster"]
        elif lvl in ("L01", "L02", "L03"):
            ext_mat = mats["dark_plaster"]
        else:
            ext_mat = mats["pale_plaster"]

        # Structural floor slab
        bm_slab = bmesh.new()
        add_box(bm_slab, 0.0, 0.0, z0, W, D, z0 + SLAB_T)
        builder.add_mesh("B01", lvl, "NONE", "slab", bm_slab, mats["interior_floor"], col_name, uv_tile=4.0, confidence=0.8)

        bm_corr = bmesh.new()
        add_box(bm_corr, 4.2, CORR_Y0, z0 + SLAB_T, W - 4.2, CORR_Y1, z0 + SLAB_T + 0.025)
        add_box(bm_corr, CORE_X0, 0.3, z0 + SLAB_T, CORE_X1, CORR_Y1, z0 + SLAB_T + 0.025)
        builder.add_mesh("B01", lvl, "NONE", "slab", bm_corr, mats["corridor_tile"], col_name, uv_tile=3.0, confidence=0.8)

        inset = 0.22 if lvl == "L00" else 0.0
        bm_ext = bmesh.new()
        bm_terrace_floor = bmesh.new()
        bm_glass = bmesh.new()
        bm_backing = bmesh.new()
        bm_warm = bmesh.new()
        bm_mullion = bmesh.new()
        bm_sill = bmesh.new()
        bm_balc = bmesh.new()
        bm_hood = bmesh.new()
        bm_l04_upper_glass = bmesh.new()
        bm_l04_upper_mullion = bmesh.new()
        bm_l04_upper_warm = bmesh.new()

        # West & East gable walls (strictly between south/north walls)
        add_box(bm_ext, inset, inset + WALL_T, z0, inset + WALL_T, D - inset - WALL_T, z1)
        add_box(bm_ext, W - inset - WALL_T, inset + WALL_T, z0, W - inset, D - inset - WALL_T, z1)

        if lvl == "L00":
            add_box(bm_ext, inset, inset, z0, W - inset, inset + WALL_T, z1)
            add_box(bm_ext, inset, D - inset - WALL_T, z0, W - inset, D - inset, z1)

            # Ground-floor South & North terrace wing privacy walls (exact L00.svg unit dividers)
            for dx in L00_SOUTH_DIVIDERS:
                add_box(bm_ext, dx - 0.12, -2.75, 0.0, dx + 0.12, inset, 2.55)
                add_box(bm_sill, dx - 0.14, -2.78, 2.55, dx + 0.14, inset, 2.62)
                add_box(bm_sill, dx - 0.09, -4.85, 0.0, dx + 0.09, -2.75, 1.15)
            for dx in L00_NORTH_DIVIDERS:
                add_box(bm_ext, dx - 0.11, D - inset, 0.0, dx + 0.11, D + 2.40, 2.15)
                add_box(bm_sill, dx - 0.09, D + 2.40, 0.0, dx + 0.09, D + 3.60, 1.10)

            add_box(bm_sill, -5.2, D * 0.5 - 0.09, 0.0, 0.0, D * 0.5 + 0.09, 1.15)
            add_box(bm_sill, W, D * 0.5 - 0.09, 0.0, W + 6.4, D * 0.5 + 0.09, 1.15)

            # Cantilevered dark steel open-louvered pergola roof along South ground terraces
            for px0, px1 in ((-0.4, CORE_X0 - 0.5), (CORE_X1 + 0.5, W + 0.4)):
                add_box(bm_mullion, px0, -2.75, z1 - 0.18, px1, -2.58, z1 - 0.03)
                add_box(bm_mullion, px0, -0.22, z1 - 0.18, px1, 0.0, z1 - 0.03)
                lx = px0
                while lx <= px1:
                    add_box(bm_mullion, lx - 0.03, -2.68, z1 - 0.14, lx + 0.03, -0.18, z1 - 0.05)
                    lx += 0.58
            for cx in [0.0, 12.35, 17.72, 25.96, 41.31, 47.36, 55.73, W]:
                add_box(bm_mullion, cx - 0.07, -2.72, 0.0, cx + 0.07, -2.58, z1 - 0.15)

            # Main glass residential entrance foyer (26.18..32.14, warm lit at golden hour!)
            add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, 29.16, inset, 0.10, z1 - 0.25, 5.4, -1.0, shutter=False, warm_lit=True)

            # Exact 1:1 South & North L00 double-leaf terrace doors (from floor-prizemlje.png!)
            for idx, (wx0, wx1) in enumerate(L00_SOUTH_DOORS):
                add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, (wx0 + wx1) * 0.5, inset, 0.12, z1 - 0.36, wx1 - wx0, -1.0, shutter=False, warm_lit=(idx % 4 == 1))
            for idx, (wx0, wx1) in enumerate(L00_NORTH_DOORS):
                add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, (wx0 + wx1) * 0.5, D - inset, 0.12, z1 - 0.36, wx1 - wx0, 1.0, shutter=False, warm_lit=(idx % 5 == 2))
            for end_side in ("west", "east"):
                ex_face = inset if end_side == "west" else (W - inset)
                edir = -1.0 if end_side == "west" else 1.0
                for wy0, wy1 in L00_GABLE_WINDOWS:
                    add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, ex_face, wy0, wy1, 0.90, z1 - 0.42, edir)

        elif lvl in ("L01", "L02", "L03"):
            lvl_i = int(lvl[-1])
            add_box(bm_ext, -0.04, -0.04, z0, W + 0.04, D + 0.04, z0 + 0.22)

            # --- 1:1 SOUTH FACADE: CARVED SEMI-RECESSED + CANTILEVERED BALCONIES & EXACT WINDOWS ---
            south_holes = [(b[0], b[1]) for b in L13_SOUTH_BALCONIES]
            for sx0, sx1 in complement_spans(0.0, W, south_holes):
                add_box(bm_ext, sx0, 0.0, z0, sx1, WALL_T, z1)

            # Place ALL 13 exact floorplan-measured South windows!
            for idx, (wx0, wx1) in enumerate(L13_SOUTH_WINDOWS):
                warm = ((idx + lvl_i * 3) % 5 == 0)
                add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, (wx0 + wx1) * 0.5, 0.0, z0 + 0.90, z1 - 0.42, wx1 - wx0, -1.0, shutter=True, warm_lit=warm)

            # Stairwell vertical landing slit window (exact core location)
            add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, 33.15, 0.0, z0 + 0.65, z1 - 0.35, 0.85, -1.0, shutter=False, warm_lit=True)

            RECESS_IN = 1.05
            PROJ_OUT = 1.15
            for bidx, (bx0, bx1, div_x) in enumerate(L13_SOUTH_BALCONIES):
                add_box(bm_ext, bx0, 0.0, z1 - 0.24, bx1, RECESS_IN + WALL_T, z1)
                add_box(bm_ext, bx0, RECESS_IN, z0, bx1, RECESS_IN + WALL_T, z1)
                add_box(bm_ext, bx0, 0.0, z0, bx0 + 0.22, RECESS_IN, z1)
                add_box(bm_ext, bx1 - 0.22, 0.0, z0, bx1, RECESS_IN, z1)
                add_box(bm_balc, bx0, -PROJ_OUT, z0, bx1, 0.02, z0 + 0.22)
                add_box(bm_terrace_floor, bx0 + 0.16, -PROJ_OUT + 0.16, z0 + 0.22, bx1 - 0.16, RECESS_IN, z0 + 0.25)
                add_box(bm_balc, bx0, -PROJ_OUT, z0 + 0.22, bx1, -PROJ_OUT + 0.18, z0 + 0.82)
                add_box(bm_balc, bx0, -PROJ_OUT, z0 + 0.22, bx0 + 0.18, 0.02, z0 + 0.82)
                add_box(bm_balc, bx1 - 0.18, -PROJ_OUT, z0 + 0.22, bx1, 0.02, z0 + 0.82)
                add_box(bm_mullion, bx0 + 0.06, -PROJ_OUT + 0.06, z0 + 1.05, bx1 - 0.06, -PROJ_OUT + 0.12, z0 + 1.10)
                add_box(bm_mullion, bx0 + 0.06, -PROJ_OUT + 0.06, z0 + 0.82, bx0 + 0.11, -PROJ_OUT + 0.12, z0 + 1.10)
                add_box(bm_mullion, bx1 - 0.11, -PROJ_OUT + 0.06, z0 + 0.82, bx1 - 0.06, -PROJ_OUT + 0.12, z0 + 1.10)
                add_box(bm_mullion, bx0 + 0.06, -PROJ_OUT + 0.06, z0 + 1.05, bx0 + 0.12, 0.02, z0 + 1.10)
                add_box(bm_mullion, bx1 - 0.12, -PROJ_OUT + 0.06, z0 + 1.05, bx1 - 0.06, 0.02, z0 + 1.10)
                if div_x is not None:
                    add_box(bm_balc, div_x - 0.13, -PROJ_OUT, z0 + 0.22, div_x + 0.13, RECESS_IN, z1 - 0.02)
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, bx0 + 0.22, div_x - 0.14, RECESS_IN, z0, z1, -1.0, warm_lit=((bidx + lvl_i) % 3 == 0))
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, div_x + 0.14, bx1 - 0.22, RECESS_IN, z0, z1, -1.0, warm_lit=((bidx + lvl_i) % 3 == 1))
                else:
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, bx0 + 0.22, bx1 - 0.22, RECESS_IN, z0, z1, -1.0, warm_lit=((bidx + lvl_i) % 3 == 0))

            # --- 1:1 NORTH FACADE: 11 CARVED LOGGIAS + 11 EXACT FLOORPLAN WINDOWS ---
            for sx0, sx1 in complement_spans(0.0, W, L13_NORTH_LOGGIAS):
                add_box(bm_ext, sx0, D - WALL_T, z0, sx1, D, z1)
            for idx, (wx0, wx1) in enumerate(L13_NORTH_WINDOWS):
                add_window_assembly(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, (wx0 + wx1) * 0.5, D, z0 + 0.90, z1 - 0.42, wx1 - wx0, 1.0, shutter=True, warm_lit=((idx + lvl_i) % 4 == 0))

            LOGGIA_DEPTH = 1.72
            for lidx, (lx0, lx1) in enumerate(L13_NORTH_LOGGIAS):
                add_box(bm_ext, lx0, D - LOGGIA_DEPTH - WALL_T, z1 - 0.24, lx1, D, z1)
                add_box(bm_ext, lx0, D - LOGGIA_DEPTH - WALL_T, z0, lx1, D - LOGGIA_DEPTH, z1)
                add_box(bm_ext, lx0, D - LOGGIA_DEPTH, z0, lx0 + 0.16, D, z1)
                add_box(bm_ext, lx1 - 0.16, D - LOGGIA_DEPTH, z0, lx1, D, z1)
                add_box(bm_terrace_floor, lx0 + 0.14, D - LOGGIA_DEPTH, z0 + 0.22, lx1 - 0.14, D, z0 + 0.25)
                add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, lx0 + 0.16, lx1 - 0.16, D - LOGGIA_DEPTH, z0, z1, 1.0, warm_lit=((lidx + lvl_i) % 4 == 1))
                add_box(bm_mullion, lx0 + 0.14, D - 0.10, z0 + 1.02, lx1 - 0.14, D - 0.04, z0 + 1.07)
                add_box(bm_mullion, lx0 + 0.14, D - 0.10, z0 + 0.72, lx1 - 0.14, D - 0.05, z0 + 0.76)
                add_box(bm_mullion, lx0 + 0.14, D - 0.10, z0 + 0.44, lx1 - 0.14, D - 0.05, z0 + 0.48)
                add_box(bm_mullion, lx0 + 0.15, D - 0.10, z0 + 0.22, lx0 + 0.20, D - 0.04, z0 + 1.07)
                add_box(bm_mullion, lx1 - 0.20, D - 0.10, z0 + 0.22, lx1 - 0.15, D - 0.04, z0 + 1.07)

            # Exact 1:1 West & East gable windows (4 per side)
            for end_side in ("west", "east"):
                ex_face = 0.0 if end_side == "west" else W
                edir = -1.0 if end_side == "west" else 1.0
                for gidx, (wy0, wy1) in enumerate(L13_GABLE_WINDOWS):
                    add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, ex_face, wy0, wy1, z0 + 0.90, z1 - 0.42, edir, warm_lit=((gidx + lvl_i) % 3 == 0))

        else:
            # --- L04 + GALLERY DUPLEX (1:1 FLOORPLAN PRIORITY: floor-etaza-4.png & floor-galerije.png) ---
            z_mid = z0 + 2.85
            add_box(bm_ext, -0.04, -0.04, z0, W + 0.04, D + 0.04, z0 + 0.22)
            # Upper gallery continuous walls
            add_box(bm_ext, 0.0, 0.0, z_mid, W, WALL_T, z1)
            add_box(bm_ext, 0.0, D - WALL_T, z_mid, W, D, z1)

            # L04 SOUTH: Semi-recessed + CANTILEVERED balconies matching floor-etaza-4.png 1:1!
            s_holes = [(t[0], t[1]) for t in L04_SOUTH_BALCONIES]
            for sx0, sx1 in complement_spans(0.0, W, s_holes):
                add_box(bm_ext, sx0, 0.0, z0, sx1, WALL_T, z_mid)

            T_IN = 1.10
            T_OUT = 1.05  # Floorplan-exact balcony projection on L04 South!
            for tidx, (tx0, tx1, div_x) in enumerate(L04_SOUTH_BALCONIES):
                add_box(bm_ext, tx0, T_IN, z0, tx1, T_IN + WALL_T, z_mid)
                add_box(bm_ext, tx0, 0.0, z0, tx0 + 0.18, T_IN, z_mid)
                add_box(bm_ext, tx1 - 0.18, 0.0, z0, tx1, T_IN, z_mid)
                # Cantilevered pale limestone balcony slab + tiled floor
                add_box(bm_ext, tx0, -T_OUT, z0, tx1, 0.02, z0 + 0.22)
                add_box(bm_terrace_floor, tx0 + 0.16, -T_OUT + 0.14, z0 + 0.22, tx1 - 0.16, T_IN, z0 + 0.25)
                # Sleek architectural glass/metal balustrade on L04 cantilevered terraces
                add_box(bm_ext, tx0, -T_OUT, z0 + 0.22, tx1, -T_OUT + 0.16, z0 + 0.72)
                add_box(bm_ext, tx0, -T_OUT, z0 + 0.22, tx0 + 0.16, 0.02, z0 + 0.72)
                add_box(bm_ext, tx1 - 0.16, -T_OUT, z0 + 0.22, tx1, 0.02, z0 + 0.72)
                add_box(bm_mullion, tx0 + 0.06, -T_OUT + 0.06, z0 + 1.02, tx1 - 0.06, -T_OUT + 0.12, z0 + 1.07)
                add_box(bm_mullion, tx0 + 0.06, -T_OUT + 0.06, z0 + 0.72, tx0 + 0.11, -T_OUT + 0.12, z0 + 1.07)
                add_box(bm_mullion, tx1 - 0.11, -T_OUT + 0.06, z0 + 0.72, tx1 - 0.06, -T_OUT + 0.12, z0 + 1.07)
                add_box(bm_mullion, tx0 + 0.06, -T_OUT + 0.06, z0 + 1.02, tx0 + 0.12, 0.02, z0 + 1.07)
                add_box(bm_mullion, tx1 - 0.12, -T_OUT + 0.06, z0 + 1.02, tx1 - 0.06, 0.02, z0 + 1.07)
                if div_x is not None:
                    add_box(bm_ext, div_x - 0.12, -T_OUT, z0 + 0.22, div_x + 0.12, T_IN, z_mid)
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, tx0 + 0.18, div_x - 0.12, T_IN, z0, z_mid, -1.0, warm_lit=(tidx % 2 == 0))
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, div_x + 0.12, tx1 - 0.18, T_IN, z0, z_mid, -1.0, warm_lit=(tidx % 2 == 1))
                else:
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, tx0 + 0.18, tx1 - 0.18, T_IN, z0, z_mid, -1.0, warm_lit=True)

            # L04 NORTH: Flush recessed loggias matching floor-etaza-4.png 1:1
            n_holes = [(t[0], t[1]) for t in L04_NORTH_LOGGIAS]
            for sx0, sx1 in complement_spans(0.0, W, n_holes):
                add_box(bm_ext, sx0, D - WALL_T, z0, sx1, D, z_mid)
            N_IN = 1.75
            for tidx, (tx0, tx1, div_x) in enumerate(L04_NORTH_LOGGIAS):
                add_box(bm_ext, tx0, D - N_IN - WALL_T, z0, tx1, D - N_IN, z_mid)
                add_box(bm_ext, tx0, D - N_IN, z0, tx0 + 0.18, D, z_mid)
                add_box(bm_ext, tx1 - 0.18, D - N_IN, z0, tx1, D, z_mid)
                add_box(bm_terrace_floor, tx0 + 0.16, D - N_IN, z0 + 0.22, tx1 - 0.16, D, z0 + 0.25)
                add_box(bm_mullion, tx0 + 0.14, D - 0.11, z0 + 1.02, tx1 - 0.14, D - 0.05, z0 + 1.07)
                add_box(bm_mullion, tx0 + 0.14, D - 0.10, z0 + 0.65, tx1 - 0.14, D - 0.06, z0 + 0.69)
                if div_x is not None:
                    add_box(bm_ext, div_x - 0.12, D - N_IN, z0 + 0.22, div_x + 0.12, D, z_mid)
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, tx0 + 0.18, div_x - 0.12, D - N_IN, z0, z_mid, 1.0, warm_lit=(tidx % 2 == 1))
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, div_x + 0.12, tx1 - 0.18, D - N_IN, z0, z_mid, 1.0)
                else:
                    add_balcony_door_recess(bm_glass, bm_backing, bm_warm, bm_mullion, tx0 + 0.18, tx1 - 0.18, D - N_IN, z0, z_mid, 1.0)

            # Exact 1:1 Upper Gallery Windows (South & North, from floor-galerije.png!)
            for idx, (wx0, wx1) in enumerate(L04_GALLERY_SOUTH_WINDOWS):
                add_window_assembly(bm_l04_upper_glass, bm_backing, bm_l04_upper_warm, bm_l04_upper_mullion, bm_sill, (wx0 + wx1) * 0.5, 0.0, z_mid + 0.85, z1 - 0.42, wx1 - wx0, -1.0, shutter=True, warm_lit=(idx % 3 == 0))
            for idx, (wx0, wx1) in enumerate(L04_GALLERY_NORTH_WINDOWS):
                add_window_assembly(bm_l04_upper_glass, bm_backing, bm_l04_upper_warm, bm_l04_upper_mullion, bm_sill, (wx0 + wx1) * 0.5, D, z_mid + 0.85, z1 - 0.42, wx1 - wx0, 1.0, shutter=True, warm_lit=(idx % 4 == 1))

            # Central solid stairwell wall lower windows on South L04 (exact from floor-etaza-4.png!)
            add_window_assembly(bm_l04_upper_glass, bm_backing, bm_l04_upper_warm, bm_l04_upper_mullion, bm_sill, 30.35, 0.0, z0 + 0.90, z_mid - 0.42, 0.68, -1.0, shutter=True)
            add_window_assembly(bm_l04_upper_glass, bm_backing, bm_l04_upper_warm, bm_l04_upper_mullion, bm_sill, 33.63, 0.0, z0 + 0.90, z_mid - 0.42, 1.22, -1.0, shutter=True, warm_lit=True)

            # Exact 7 double-height curtain-wall glass bays + olive hoods (South & North)
            for side, glass_bays in (("south", L04_SOUTH_GLASS_BAYS), ("north", L04_NORTH_GLASS_BAYS)):
                y_face = 0.0 if side == "south" else D
                out_dir = -1.0 if side == "south" else 1.0
                for gidx, (bx0, bx1) in enumerate(glass_bays):
                    by0, by1 = y_face + out_dir * 0.06, y_face + out_dir * 0.01
                    target_back = bm_l04_upper_warm if (gidx % 2 == 0) else bm_backing
                    add_box(target_back, bx0 + 0.08, min(by0, by1), z0 + 0.14, bx1 - 0.08, max(by0, by1), z1 - 0.04)
                    gy0, gy1 = y_face + out_dir * 0.13, y_face + out_dir * 0.08
                    add_box(bm_l04_upper_glass, bx0 + 0.10, min(gy0, gy1), z0 + 0.15, bx1 - 0.10, max(gy0, gy1), z1 - 0.05)
                    my0, my1 = y_face + out_dir * 0.17, y_face + out_dir * 0.05
                    n_cols = max(2, int(round((bx1 - bx0) / 1.45)))
                    for ci in range(n_cols + 1):
                        mx = bx0 + 0.10 + ci * ((bx1 - bx0 - 0.20) / n_cols)
                        add_box(bm_l04_upper_mullion, mx - 0.04, min(my0, my1), z0 + 0.15, mx + 0.04, max(my0, my1), z1 - 0.05)
                    for mz in (z0 + 0.15, z0 + 1.80, z_mid, z_mid + 1.45, z1 - 0.08):
                        add_box(bm_l04_upper_mullion, bx0 + 0.08, min(my0, my1), mz - 0.045, bx1 - 0.08, max(my0, my1), mz + 0.045)
                    add_trapezoid_hood(bm_hood, bm_l04_upper_mullion, bx0, bx1, y_face, z0, z1, proj=0.46, side=side)

            # Corner glass returns + exact L04 & Gallery Gable windows (from floor-etaza-4.png & floor-galerije.png!)
            for end_side in ("west", "east"):
                ex_face = 0.0 if end_side == "west" else W
                edir = -1.0 if end_side == "west" else 1.0
                for (ey0, ey1) in ((0.0, 2.8), (D - 2.8, D)):
                    bx0, bx1 = ex_face + edir * 0.06, ex_face + edir * 0.01
                    gx0, gx1 = ex_face + edir * 0.13, ex_face + edir * 0.08
                    mx0, mx1 = ex_face + edir * 0.17, ex_face + edir * 0.05
                    add_box(bm_l04_upper_warm, min(bx0, bx1), ey0 + 0.08, z0 + 0.14, max(bx0, bx1), ey1 - 0.08, z1 - 0.04)
                    add_box(bm_l04_upper_glass, min(gx0, gx1), ey0 + 0.10, z0 + 0.15, max(gx0, gx1), ey1 - 0.10, z1 - 0.05)
                    for mz in (z0 + 0.15, z_mid, z1 - 0.08):
                        add_box(bm_l04_upper_mullion, min(mx0, mx1), ey0 + 0.08, mz - 0.04, max(mx0, mx1), ey1 - 0.08, mz + 0.04)
                if end_side == "west":
                    for wy0, wy1 in L04_LOWER_GABLE_WINDOWS_W:
                        add_gable_window(bm_glass, bm_backing, bm_warm, bm_mullion, bm_sill, ex_face, wy0, wy1, z0 + 0.90, z_mid - 0.42, edir)
                for wy0, wy1 in L04_GALLERY_GABLE_WINDOWS:
                    add_gable_window(bm_l04_upper_glass, bm_backing, bm_l04_upper_warm, bm_l04_upper_mullion, bm_sill, ex_face, wy0, wy1, z_mid + 0.85, z1 - 0.42, edir, warm_lit=True)

            # Roof slab, parapet & stairwell penthouse bulkhead
            bm_roof = bmesh.new()
            add_box(bm_roof, 0.0, 0.0, z1, W, D, z1 + 0.28)
            add_box(bm_roof, CORE_X0 + 2.0, 3.0, z1 + 0.28, CORE_X1 + 0.2, 8.5, z1 + 1.55)
            add_box(bm_roof, 0.0, 0.0, z1 + 0.28, W, 0.35, z1 + 0.58)
            add_box(bm_roof, 0.0, D - 0.35, z1 + 0.28, W, D, z1 + 0.58)
            builder.add_mesh("B01", "L04", "NONE", "roof", bm_roof, mats["roof_gravel"], col_name, uv_tile=5.0, confidence=0.75)

        # Crisp cutaway interior partition walls
        part_z1 = z0 + 2.35
        bm_int = bmesh.new()
        add_box(bm_int, 4.5, CORR_Y0 - PART_T * 0.5, z0 + SLAB_T, CORE_X0, CORR_Y0 + PART_T * 0.5, part_z1)
        add_box(bm_int, CORE_X1, CORR_Y0 - PART_T * 0.5, z0 + SLAB_T, W - 4.5, CORR_Y0 + PART_T * 0.5, part_z1)
        add_box(bm_int, 4.5, CORR_Y1 - PART_T * 0.5, z0 + SLAB_T, W - 4.5, CORR_Y1 + PART_T * 0.5, part_z1)
        add_box(bm_int, CORE_X0, 3.65, z0 + SLAB_T, CORE_X0 + 0.22, CORR_Y0, part_z1)
        add_box(bm_int, CORE_X1 - 0.22, 0.35, z0 + SLAB_T, CORE_X1, CORR_Y0, part_z1)
        add_box(bm_int, CORE_X0, 3.55, z0 + SLAB_T, CORE_X1 - 2.35, 3.77, part_z1)
        seen_x_south, seen_x_north = set(), set()
        for u in floor_units:
            bb = u["building_bbox_m"]
            for xv in (bb["x0"], bb["x1"]):
                if 0.6 < xv < W - 0.6:
                    rx = round(xv, 1)
                    if u["primary_side"] == "south" and rx not in seen_x_south:
                        if CORE_X0 + 0.4 < xv < CORE_X1 - 0.4:
                            continue
                        seen_x_south.add(rx)
                        add_box(bm_int, xv - PART_T * 0.5, WALL_T, z0 + SLAB_T, xv + PART_T * 0.5, CORR_Y0, part_z1)
                    elif u["primary_side"] == "north" and rx not in seen_x_north:
                        seen_x_north.add(rx)
                        add_box(bm_int, xv - PART_T * 0.5, CORR_Y1, z0 + SLAB_T, xv + PART_T * 0.5, D - WALL_T, part_z1)

        builder.add_mesh("B01", lvl, "NONE", "wall", bm_ext, ext_mat, col_name, uv_tile=5.5, confidence=0.8)
        builder.add_mesh("B01", lvl, "NONE", "wall", bm_int, mats["interior_wall"], col_name, uv_tile=4.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "balcony", bm_terrace_floor, mats["terrace_tile"], col_name, uv_tile=2.5, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "window", bm_backing, mats["glass_backing"], col_name, uv_tile=2.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "window", bm_warm, mats["warm_interior"], col_name, uv_tile=2.0, confidence=0.7)
        builder.add_mesh("B01", lvl, "NONE", "window", bm_glass, mats["glass"], col_name, uv_tile=2.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "window", bm_mullion, mats["mullion"], col_name, uv_tile=2.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "window", bm_sill, mats["sill"], col_name, uv_tile=2.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "balcony", bm_balc, mats["dark_plaster"], col_name, uv_tile=4.0, confidence=0.8)
        # Upper L04 hoods & gallery glass tagged 'roof' so Plan 3D slices cleanly
        builder.add_mesh("B01", lvl, "NONE", "roof", bm_hood, mats["olive_hood"], col_name, uv_tile=4.0, confidence=0.8)
        builder.add_mesh("B01", lvl, "NONE", "roof", bm_l04_upper_warm, mats["warm_interior"], col_name, uv_tile=2.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "roof", bm_l04_upper_glass, mats["glass"], col_name, uv_tile=2.0, confidence=0.75)
        builder.add_mesh("B01", lvl, "NONE", "roof", bm_l04_upper_mullion, mats["mullion"], col_name, uv_tile=2.0, confidence=0.75)

    # ------------------------------------------------------------------
    # 3. SAVE .BLEND AND EXPORT GLB + MANIFEST
    # ------------------------------------------------------------------
    os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

    bpy.ops.object.select_all(action="DESELECT")
    meshable = [ob for ob in bpy.data.objects if ob.type == "MESH"]
    for ob in meshable:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshable[0]

    bpy.ops.export_scene.gltf(
        filepath=GLB_OUT,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_lights=False,
        export_cameras=False,
        export_image_format="JPEG",
        export_jpeg_quality=86,
    )

    total_tris = 0
    manifest_objs = []
    for ob in sorted(meshable, key=lambda o: o.name):
        me = ob.data
        me.calc_loop_triangles()
        tris = len(me.loop_triangles)
        total_tris += tris
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        lo = [round(min(p[i] for p in pts), 3) for i in range(3)]
        hi = [round(max(p[i] for p in pts), 3) for i in range(3)]
        manifest_objs.append({
            "name": ob.name,
            "building": ob.get("building"),
            "level": ob.get("level"),
            "unit": ob.get("unit"),
            "type": ob.get("type"),
            "triangles": tris,
            "bbox_m": {"min": lo, "max": hi},
            "source_ref": ob.get("source_ref"),
            "confidence": ob.get("confidence"),
        })

    manifest = {
        "schema": "mocire-h.blender-manifest/4",
        "units": "meters",
        "frame": "Blender Z-up; glTF Y-up",
        "estimation_flag": SOURCE_REF,
        "building_m": bldg,
        "glb": os.path.basename(GLB_OUT),
        "glb_bytes": os.path.getsize(GLB_OUT),
        "object_count": len(manifest_objs),
        "total_triangles": total_tris,
        "objects": manifest_objs,
    }
    with open(MANIFEST_OUT, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    print(
        f"CINEMATIC 1:1 MOČIRE 3D BUILD_OK: {len(manifest_objs)} objects, {total_tris} tris, "
        f"{os.path.getsize(GLB_OUT) / 1024:.1f} KB -> {GLB_OUT}",
        flush=True,
    )


if __name__ == "__main__":
    main()
