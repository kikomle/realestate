"""Sun + area lights, and named cameras: CAM_aerial, CAM_facade, CAM_floor, CAM_orbit."""
import math

import bpy
from mathutils import Vector

LEVEL_H = 3.05


def _light(name, kind, energy, collection, location=None, size=None):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    if kind == "AREA":
        data.shape = "SQUARE"
        data.size = size
    ob = bpy.data.objects.new(name, data)
    collection.objects.link(ob)
    if location is not None:
        ob.location = location
    return ob


def _camera(name, location, target, collection, lens=35.0):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 1000.0
    ob = bpy.data.objects.new(name, data)
    collection.objects.link(ob)
    ob.location = location
    direction = Vector(target) - Vector(location)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return ob


def setup(scene, collection):
    sun = _light("RIG__sun", "SUN", 3.0, collection)
    sun.rotation_euler = (math.radians(55.0), 0.0, math.radians(-35.0))

    _light("RIG__fill_area", "AREA", 400.0, collection, location=(30.0, 4.0, 40.0), size=60.0)
    for level, z in (("L00", 2.6), ("L01", LEVEL_H + 2.6)):
        for i, (x, y) in enumerate(((3.0, 2.0), (3.0, 6.0), (9.0, 2.0), (9.0, 6.0))):
            _light(f"RIG__{level}_interior_{i:02d}", "AREA", 120.0, collection, location=(x, y, z), size=2.5)
            _light(f"RIG__{level}_interior_{i:02d}_b2", "AREA", 120.0, collection, location=(x + 18.0, y, z), size=2.5)

    aerial = _camera("CAM_aerial", (-30.0, -55.0, 45.0), (30.0, 4.0, 3.0), collection)
    facade = _camera("CAM_facade", (6.0, -20.0, 2.0), (6.0, 0.0, 2.5), collection)
    floor = _camera("CAM_floor", (1.6, 1.5, LEVEL_H + 1.2), (1.6, 6.5, LEVEL_H + 0.8), collection)

    pivot = bpy.data.objects.new("RIG__orbit_pivot", None)
    pivot.location = (30.0, 4.0, 3.0)
    collection.objects.link(pivot)
    orbit = _camera("CAM_orbit", (0.0, 0.0, 0.0), (30.0, 4.0, 3.0), collection)
    orbit.parent = pivot
    orbit.location = (-55.0, 0.0, 18.0)
    track = orbit.constraints.new("TRACK_TO")
    track.target = pivot
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    scene.camera = aerial
