"""Render a turntable-style preview thumbnail of a model to PNG (CPU, headless).

Useful for an agent to "look at" a generated asset: import, frame it with a
camera, render one image with Cycles on CPU (works on WSL with no GPU).

Example:
  blender_run.sh render_preview.py -- --in unit.glb --out unit.png --size 512
"""
import argparse
import math

import bpy
import mathutils

import lib


def main():
    p = argparse.ArgumentParser(description="Render a preview PNG of a model")
    p.add_argument("--in", dest="inp", required=True)
    p.add_argument("--out", required=True, help="output .png path")
    p.add_argument("--size", type=int, default=512)
    args = lib.get_args(p)

    lib.reset_scene()
    added = lib.import_model(args.inp)
    meshes = [o for o in added if o.type == "MESH"]
    if not meshes:
        raise SystemExit("no mesh to render")

    # Bounding sphere of all meshes for camera framing.
    coords = [obj.matrix_world @ v.co for obj in meshes for v in obj.data.vertices]
    center = sum(coords, mathutils.Vector()) / len(coords)
    radius = max((c - center).length for c in coords) or 1.0

    # Camera at a 3/4 angle, distance scaled to the bounding sphere.
    cam_data = bpy.data.cameras.new("preview_cam")
    cam = bpy.data.objects.new("preview_cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    dist = radius * 3.0
    cam.location = center + mathutils.Vector((dist * 0.7, -dist * 0.7, dist * 0.5))
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    # Simple sun light.
    sun_data = bpy.data.lights.new("sun", type="SUN")
    sun_data.energy = 3.0
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = (math.radians(50), 0, math.radians(40))
    bpy.context.scene.collection.objects.link(sun)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.render.resolution_x = args.size
    scene.render.resolution_y = args.size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = args.out

    lib.log(f"rendering {args.size}x{args.size} preview...")
    bpy.ops.render.render(write_still=True)
    lib.log(f"wrote {args.out}")


if __name__ == "__main__":
    main()
