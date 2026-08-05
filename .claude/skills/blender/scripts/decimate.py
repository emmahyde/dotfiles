"""Reduce polygon count on every mesh, then export to GLB.

Generated 3D assets (Meshy, photogrammetry) are often far denser than a game
needs. This applies a Decimate modifier at a target ratio and re-exports.

Example:
  blender_run.sh decimate.py -- --in dense.glb --out lod.glb --ratio 0.25
"""
import argparse

import bpy

import lib


def main():
    p = argparse.ArgumentParser(description="Decimate meshes and export GLB")
    p.add_argument("--in", dest="inp", required=True)
    p.add_argument("--out", required=True)
    p.add_argument(
        "--ratio",
        type=float,
        default=0.5,
        help="keep this fraction of faces (0-1); 0.25 = 75%% reduction",
    )
    args = lib.get_args(p)

    lib.reset_scene()
    lib.import_model(args.inp)

    total_before = total_after = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        total_before += len(obj.data.polygons)
        mod = obj.modifiers.new(name="decimate", type="DECIMATE")
        mod.ratio = args.ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)
        total_after += len(obj.data.polygons)

    lib.log(f"faces {total_before} -> {total_after} (ratio {args.ratio})")
    lib.export_glb(args.out)
    lib.log(f"wrote {args.out}")


if __name__ == "__main__":
    main()
