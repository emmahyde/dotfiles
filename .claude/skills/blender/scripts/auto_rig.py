"""Best-effort humanoid auto-rig using Rigify, then export to GLB.

WHAT THIS DOES: imports a single upright humanoid mesh, drops in a Rigify human
meta-rig scaled to the mesh's bounding box, generates the deform rig, and binds
the mesh with automatic weights.

HONEST LIMITS: this is a *starting point*, not a finished rig. Automatic weights
on a generated mesh frequently need weight-paint cleanup, and the meta-rig is
fitted by bounding box, not by detecting actual limbs. Use it to get a riggable
GLB fast; expect manual touch-up in the GUI for production quality. For
non-humanoid shapes (vehicles, creatures) this will not produce a sensible rig.
If your generator (e.g. Meshy AI) already exports a rigged GLB, prefer that and
skip this script.

Example:
  blender_run.sh auto_rig.py -- --in character.glb --out character_rigged.glb
"""
import argparse

import bpy

import lib


def main():
    p = argparse.ArgumentParser(description="Auto-rig a humanoid mesh with Rigify")
    p.add_argument("--in", dest="inp", required=True)
    p.add_argument("--out", required=True)
    args = lib.get_args(p)

    # reset first: read_factory_settings reloads prefs and would disable any
    # addon enabled beforehand, so enable Rigify *after* the reset.
    lib.reset_scene()
    lib.ensure_addon("rigify")
    added = lib.import_model(args.inp)
    meshes = [o for o in added if o.type == "MESH"]
    if not meshes:
        raise SystemExit("no mesh found in input")

    # Combined bounding box across all imported meshes (world space).
    zs = [(obj.matrix_world @ v.co).z for obj in meshes for v in obj.data.vertices]
    height = max(zs) - min(zs)
    floor_z = min(zs)
    lib.log(f"mesh height ~= {height:.3f}")

    # Add a Rigify human meta-rig, fit it to the mesh height.
    # The default meta-rig is ~1.8 m tall standing on the origin.
    bpy.ops.object.armature_human_metarig_add()
    metarig = bpy.context.active_object
    scale = height / 1.8 if height > 0 else 1.0
    metarig.scale = (scale, scale, scale)
    metarig.location = (0.0, 0.0, floor_z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)

    # Generate the deform rig from the meta-rig.
    bpy.context.view_layer.objects.active = metarig
    bpy.ops.pose.rigify_generate()
    rig = bpy.context.active_object
    lib.log(f"generated rig: {rig.name}")

    # Bind each mesh to the generated rig with automatic weights.
    for mesh in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        mesh.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    lib.log(f"bound {len(meshes)} mesh(es) with automatic weights")

    lib.export_glb(args.out)
    lib.log(f"wrote {args.out} (review weights in GUI before shipping)")


if __name__ == "__main__":
    main()
