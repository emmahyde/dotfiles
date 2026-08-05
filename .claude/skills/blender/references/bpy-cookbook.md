# bpy cookbook (Blender 4.5)

Recipes for writing new headless operations. All assume `import bpy` and the
helpers in `../scripts/lib.py`. Run via `blender_run.sh <script.py> -- ...`.

## Selection / active object

Blender operators act on the selection and the active object. Always set both:

```python
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
```

## Apply transforms (bake scale/rotation into geometry)

Generated assets often carry non-uniform scale. Bake it before export:

```python
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
```

## Join several meshes into one

```python
lib.select_meshes()  # selects all, sets active
bpy.ops.object.join()
```

## Recalculate / flip normals

```python
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
```

## Set / replace material

```python
mat = bpy.data.materials.new("unit_mat")
mat.use_nodes = True
obj.data.materials.clear()
obj.data.materials.append(mat)
```

## Scale to a target height (meters)

```python
zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
height = max(zs) - min(zs)
obj.scale *= target_height / height
bpy.ops.object.transform_apply(scale=True)
```

## Import an animation and retarget (concept)

Blender has no built-in cross-rig retargeter; for matching skeletons you can
copy actions directly:

```python
src_action = bpy.data.actions["Walk"]
target_rig.animation_data_create()
target_rig.animation_data.action = src_action
```

For mismatched skeletons, install the Auto-Rig Pro or Rokoko addon, or bake via
constraints. Mixamo FBX animations import cleanly and can be pushed to the NLA:

```python
bpy.ops.import_scene.fbx(filepath="walk.fbx")
track = rig.animation_data.nla_tracks.new()
track.strips.new("walk", 1, rig.animation_data.action)
```

## Batch a directory

```python
import glob, os
for path in glob.glob("/in/*.fbx"):
    lib.reset_scene()
    lib.import_model(path)
    out = os.path.join("/out", os.path.splitext(os.path.basename(path))[0] + ".glb")
    lib.export_glb(out)
```

## glTF export options worth knowing

`bpy.ops.export_scene.gltf(...)` flags: `export_draco_mesh_compression_enable`
(smaller files, needs Draco decoder in the loader), `export_yup` (Y-up, on by
default in `lib.export_glb`), `export_apply` (apply modifiers), `export_skins`
and `export_animations` (rigs/anims), `export_image_format` ("AUTO"/"JPEG"/
"WEBP" to shrink textures).

## Headless gotchas

- No GPU on WSL: use `scene.cycles.device = "CPU"`, or the Workbench engine for
  flat preview renders.
- Operators need a valid context. In `--background` the context is minimal;
  prefer data-API calls (`bpy.data...`) over operators where possible, and set
  selection/active before any operator that needs them.
- `--factory-startup` (the wrapper sets it) means user addons are off. Enable
  what you need with `lib.ensure_addon("module_name")`.
