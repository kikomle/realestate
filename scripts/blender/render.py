"""Render a named camera to PNG with Cycles (Metal GPU if available, else CPU). Smoke-test settings by default.

Run:
  Blender -b --factory-startup <file.blend> --python scripts/blender/render.py -- --camera CAM_aerial --out <file.png> [--samples 32] [--res 960 540]
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import arg_value, arg_flag  # noqa: E402


def enable_gpu():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.refresh_devices()
    for backend in ("METAL", "NONE"):
        prefs.compute_device_type = backend
        if backend == "NONE":
            break
        devices = [d for d in prefs.devices if d.type == "METAL"]
        if devices:
            for d in prefs.devices:
                d.use = d.type == "METAL"
            return "METAL"
    return "CPU"


def main():
    cam_name = arg_value("--camera", "CAM_aerial")
    out = os.path.abspath(arg_value("--out", "render.png"))
    samples = int(arg_value("--samples", "32"))
    res = [int(arg_value("--res-x", "960")), int(arg_value("--res-y", "540"))]
    os.makedirs(os.path.dirname(out), exist_ok=True)

    scene = bpy.context.scene
    cam = bpy.data.objects.get(cam_name)
    if cam is None or cam.type != "CAMERA":
        raise SystemExit(f"camera not found: {cam_name}")
    scene.camera = cam

    scene.render.engine = "CYCLES"
    device = enable_gpu() if not arg_flag("--cpu") else "CPU"
    scene.cycles.device = "GPU" if device == "METAL" else "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.render.resolution_x = res[0]
    scene.render.resolution_y = res[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = out
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"

    bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out, "camera", cam_name, "device", device, "samples", samples, flush=True)


if __name__ == "__main__":
    main()
