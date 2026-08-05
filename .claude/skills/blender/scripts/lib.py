"""Shared helpers for headless Blender (bpy) task scripts.

Imported by the task scripts in this directory. Provides argument parsing
(everything after the `--` Blender passes through), scene reset, and import/
export across the formats Blender bundles support out of the box.
"""
import argparse
import os
import sys

import bpy
import addon_utils


def get_args(parser: argparse.ArgumentParser):
    """Parse only the args after Blender's `--` separator.

    Blender consumes its own flags; user args live after a literal `--`.
    If no `--` is present, parse nothing (returns defaults).
    """
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    return parser.parse_args(args)


def reset_scene():
    """Start from an empty scene (factory-startup still seeds a cube/camera/light)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def ensure_addon(module: str):
    """Enable a bundled addon (e.g. 'io_scene_gltf2', 'rigify'); raise if missing."""
    ok = addon_utils.enable(module, default_set=True, persistent=True)
    if not ok:
        raise RuntimeError(f"could not enable Blender addon: {module}")


# --- import -------------------------------------------------------------------

def import_model(path: str):
    """Import a model by extension. Returns the list of newly added objects."""
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects)

    if ext in (".glb", ".gltf"):
        ensure_addon("io_scene_gltf2")
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        # Blender 4.x uses the wm operator for the C++ OBJ IO.
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".stl":
        bpy.ops.wm.stl_import(filepath=path)
    elif ext == ".blend":
        # Append every object from the .blend file's first scene.
        with bpy.data.libraries.load(path) as (src, dst):
            dst.objects = list(src.objects)
        for obj in dst.objects:
            if obj is not None:
                bpy.context.scene.collection.objects.link(obj)
    else:
        raise ValueError(f"unsupported import format: {ext}")

    return [o for o in bpy.data.objects if o not in before]


# --- export -------------------------------------------------------------------

def export_glb(path: str, selected_only: bool = False):
    """Export the scene (or selection) to a single binary glTF (.glb)."""
    ensure_addon("io_scene_gltf2")
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=selected_only,
        export_apply=True,          # apply modifiers
        export_yup=True,            # Y-up for web/three.js/babylon
        export_animations=True,
        export_skins=True,
    )


def select_meshes():
    """Select all mesh objects, make the first the active object. Returns them."""
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for m in meshes:
        m.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
    return meshes


def log(*parts):
    """Tagged stdout line that survives Blender's noisy output for easy grep."""
    print("[blender-skill]", *parts, flush=True)
