---
name: godot-collision-audit
description: |
  Audit physics layer/mask configurations across scenes or the whole project.
  Builds interaction matrices, flags misconfigurations, offers auto-fixes.
  Triggers on: collision audit, physics layers, collision not working,
  bullets pass through, trigger not firing, layer mask, collision matrix
---

# Collision Audit

Audit and fix physics collision layer/mask configurations using godot-mcp-pro tools.

## Prerequisites
- Godot editor open with project loaded
- godot-mcp-pro server connected

## Quick Reference: How Collision Layers Work

- **Layer** = "What I AM" (my identity)
- **Mask** = "What I DETECT" (what I scan for)
- For A to detect B: A's **mask** must include B's **layer**
- For mutual detection: both masks must include each other's layers

**CRITICAL bitmask math:**
```
Inspector Layer N = code value 1 << (N-1)
Layer 1 = 1    (1 << 0)
Layer 2 = 2    (1 << 1)
Layer 3 = 4    (1 << 2)
Layer 4 = 8    (1 << 3)
Multiple: Layer 1+3 = 1 | 4 = 5
```

**Common mistake:** `collision_layer = 3` is NOT "Layer 3" — it's Layers 1+2 (bits 0 and 1). Layer 3 alone = `4`.

## Workflow

### Mode 1: Full Audit (Proactive)

**Step 1 — Determine scope:**
- Single scene: `mcp__godot-mcp-pro__get_scene_tree`
- Whole project: scan each scene via `mcp__godot-mcp-pro__search_files` with pattern `*.tscn`

**Step 2 — Collect physics body data:**

Find all physics nodes via `mcp__godot-mcp-pro__find_nodes_by_type`:
- `StaticBody3D`, `CharacterBody3D`, `RigidBody3D`, `Area3D`
- `StaticBody2D`, `CharacterBody2D`, `RigidBody2D`, `Area2D`

For each: `mcp__godot-mcp-pro__get_collision_info` — returns layer, mask, shape info.
Also: `mcp__godot-mcp-pro__get_node_properties` — get script and groups for categorization.

**Step 3 — Read project layer names:**
`mcp__godot-mcp-pro__get_project_settings` — check `layer_names/3d_physics/layer_1` through `layer_32`.
If names aren't configured, suggest naming them.

**Step 4 — Build interaction matrix:**

Decode bitmask values to layer numbers. For each pair of categories, check if masks overlap:

```
              | Player(L1) | Enemy(L2) | Bullet(L3) | Wall(L4) |
Player(L1)    |     -      |  detect   |  detect    | collide  |
Enemy(L2)     |  detect    |     -     |  detect    | collide  |
Bullet(L3)    |     -      |  detect   |     -      | collide  |
Wall(L4)      |     -      |     -     |     -      |    -     |
```

**Step 5 — Flag issues:**

| Issue | Detection | Severity |
|-------|-----------|----------|
| Asymmetric detection | A's mask has B's layer but not vice versa | Warning |
| Orphaned body | collision_mask = 0 (detects nothing) | Error |
| Overbroad mask | many bits set unnecessarily | Info |
| No collision shape | Physics body without CollisionShape child | Error |
| Wrong bitmask | Value doesn't match expected 1 << (N-1) | Error |
| Layer conflict | Unrelated types share same layer | Warning |

**Step 6 — Report:**
```
Collision Audit Report
======================
Scene: main.tscn | Bodies scanned: 24

Interaction Matrix:
[table as above]

Issues Found:
[ERROR] EnemyDrone "World/Enemies/Drone1": no CollisionShape3D child
[ERROR] Projectile: collision_layer=3 (L1+L2) — should be 4 (L3 only)
[WARN]  PlayerArea3D: mask=0xFFFFFFFF — unnecessarily broad
[INFO]  Wall bodies: mask=0 — correct for static geometry
```

**Step 7 — Fix (if requested):**
- `mcp__godot-mcp-pro__set_physics_layers` — correct values
- `mcp__godot-mcp-pro__setup_collision` — add missing shapes
- Re-audit to verify

### Mode 2: Focused Diagnosis (Reactive)

User reports "bullets pass through enemies" or similar.

1. Identify the two types that should interact
2. Find instances in scene tree
3. `mcp__godot-mcp-pro__get_collision_info` on both
4. Check:
   - Does bullet's mask include enemy's layer?
   - If Area3D: is `monitoring` enabled?
   - Both have CollisionShape children?
   - Same physics space (same scene tree)?
5. Report the specific misconfiguration and fix

### Mode 3: New Entity Setup

Adding a new physics entity type.

1. Read existing layer conventions from project
2. Assign next available layer number
3. Determine interactions with existing types
4. Set layer and mask accordingly with `mcp__godot-mcp-pro__set_physics_layers`
5. Optionally name the layer: `mcp__godot-mcp-pro__set_project_setting`

## Project Conventions
Check the project's .claude/skills/ and CLAUDE.md for project-specific layer assignments. Many projects define their own collision layer conventions. The audit will detect and report whatever layers are in use.

## Common Pitfalls

- `collision_layer = N` when meaning `collision_layer = 1 << (N-1)`
- Area3D needs `monitoring = true` to detect bodies
- CharacterBody3D.move_and_slide() only collides with its mask
- RayCast3D has its own collision_mask separate from parent body
- Godot Inspector shows layers 1-32 but code uses bitmask values
