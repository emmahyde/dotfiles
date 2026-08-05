"""Convert / re-export a model to GLB (the web-standard format for this game).

Imports FBX/OBJ/STL/GLTF/GLB/.blend and writes a clean binary glTF. This is the
workhorse for normalizing assets coming out of Meshy AI or other generators into
something three.js / babylon.js / PlayCanvas load directly.

Example:
  blender_run.sh convert.py -- --in meshy_export.fbx --out assets/unit.glb
  blender_run.sh convert.py -- --in raw.glb --out clean.glb --selected-meshes
"""
import argparse

import lib


def main():
    p = argparse.ArgumentParser(description="Convert a model to GLB")
    p.add_argument("--in", dest="inp", required=True, help="input model path")
    p.add_argument("--out", required=True, help="output .glb path")
    p.add_argument(
        "--selected-meshes",
        action="store_true",
        help="export only mesh objects (drops stray cameras/lights/empties)",
    )
    args = lib.get_args(p)

    lib.reset_scene()
    added = lib.import_model(args.inp)
    lib.log(f"imported {len(added)} object(s) from {args.inp}")

    selected_only = False
    if args.selected_meshes:
        meshes = lib.select_meshes()
        selected_only = True
        lib.log(f"selected {len(meshes)} mesh(es) for export")

    lib.export_glb(args.out, selected_only=selected_only)
    lib.log(f"wrote {args.out}")


if __name__ == "__main__":
    main()
