"""PBR materials (Principled BSDF). Uses Poly Haven 1K maps when present in assets/blender/materials/textures."""
import os

import bpy

from common import REPO_ROOT

TEX_DIR = os.path.join(REPO_ROOT, "assets", "blender", "materials", "textures")


def _texture_path(asset, key):
    for ext in ("jpg", "png"):
        path = os.path.join(TEX_DIR, f"{asset}_{key}_1k.{ext}")
        if os.path.exists(path):
            return path
    return None


def _image_node(nt, path, colorspace, mapping):
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(path, check_existing=True)
    node.image.colorspace_settings.name = colorspace
    nt.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
    return node


def _principled(name, color, roughness, metallic=0.0, asset=None, scale=1.0):
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    diffuse = _texture_path(asset, "Diffuse") if asset else None
    if diffuse:
        coords = nt.nodes.new("ShaderNodeTexCoord")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (scale, scale, scale)
        nt.links.new(coords.outputs["Generated"], mapping.inputs["Vector"])
        d = _image_node(nt, diffuse, "sRGB", mapping)
        nt.links.new(d.outputs["Color"], bsdf.inputs["Base Color"])
        rough = _texture_path(asset, "Rough")
        if rough:
            r = _image_node(nt, rough, "Non-Color", mapping)
            nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
        normal = _texture_path(asset, "nor_gl")
        if normal:
            n = _image_node(nt, normal, "Non-Color", mapping)
            nmap = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(n.outputs["Color"], nmap.inputs["Color"])
            nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def make_plaster():
    return _principled("PLASTER_WHITE", (0.9, 0.89, 0.86), 0.85)


def make_concrete():
    return _principled("CONCRETE_POLYHAVEN", (0.55, 0.55, 0.53), 0.9, asset="concrete_wall_008", scale=1.5)


def make_wood():
    return _principled("WOOD_OAK_FLOOR", (0.45, 0.3, 0.18), 0.5, asset="wood_floor_deck", scale=1.0)


def make_glass():
    existing = bpy.data.materials.get("GLASS_CLEAR")
    if existing is not None:
        return existing
    mat = bpy.data.materials.new("GLASS_CLEAR")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (0.85, 0.92, 0.95, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.05
    bsdf.inputs["IOR"].default_value = 1.45
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    return mat


def make_ground():
    return _principled("GROUND_SITE", (0.32, 0.40, 0.28), 1.0)
