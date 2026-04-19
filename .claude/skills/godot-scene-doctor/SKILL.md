---
name: godot-scene-doctor
description: |
  Comprehensive scene health check — complexity, dependencies, signal integrity,
  unused resources, performance hints, and anti-pattern detection.
  Triggers on: scene health, audit scene, check scene, scene problems,
  scene complexity, clean up scene, scene doctor, scene lint
---

# Scene Doctor

Run diagnostic checks on Godot scenes to find issues before they become bugs.

## Prerequisites
- Godot editor open with project loaded
- godot-mcp-pro server connected

## Workflow

### Step 1: Identify Target

Use currently open scene, or `mcp__godot-mcp-pro__open_scene` for a specific path.
Then `mcp__godot-mcp-pro__get_scene_tree` to get the full node hierarchy.

### Step 2: Run Diagnostic Suite

Run checks in parallel where possible. Each produces findings: CRITICAL, WARNING, or INFO.

#### Check 1: Complexity Analysis

**Tool:** `mcp__godot-mcp-pro__analyze_scene_complexity`

| Metric | Warning | Critical |
|--------|---------|----------|
| Total nodes | >200 | >500 |
| Max nesting depth | >8 | >12 |
| AnimationPlayers | >5 | >10 |
| Scripts on deep children | >10 | >20 |

Flag disproportionate type distributions (e.g., 50 RayCast3D nodes).

#### Check 2: Signal Integrity

**Tools:** `mcp__godot-mcp-pro__find_signal_connections`, `mcp__godot-mcp-pro__analyze_signal_flow`

- Signals connected to non-existent methods = CRITICAL
- Signals emitted in scripts but never connected = WARNING
- Duplicate signal connections = WARNING
- Signals crossing >3 scene instance boundaries = INFO

#### Check 3: Dependency Health

**Tools:** `mcp__godot-mcp-pro__get_scene_dependencies`, `mcp__godot-mcp-pro__detect_circular_dependencies`

- Circular scene dependencies = CRITICAL
- Missing referenced resources = CRITICAL
- Instance chains >5 levels deep = WARNING
- Absolute path references = WARNING
- >50 unique resource dependencies = INFO

#### Check 4: Unused Resources

**Tool:** `mcp__godot-mcp-pro__find_unused_resources`

- Textures loaded but not displayed = WARNING
- Scripts attached with empty methods = INFO
- Materials created but not assigned = WARNING
- Distinguish truly unused vs runtime-loaded via `load()`/`preload()`

#### Check 5: Performance Hints

**Tools:** `mcp__godot-mcp-pro__analyze_scene_complexity`, `mcp__godot-mcp-pro__get_performance_monitors` (if running)

- MeshInstance3D count >100 without MultiMesh = WARNING
- Real-time lights >4 (Omni/Spot) = WARNING
- GPUParticles max_amount >1000 = INFO
- RayCast3D/ShapeCast3D count >10 = INFO
- Trimesh collision where box/capsule would work = WARNING
- If running: actual FPS <30, draw calls >500, physics time >8ms

#### Check 6: Anti-Pattern Detection

**Tools:** `mcp__godot-mcp-pro__search_in_files`, `mcp__godot-mcp-pro__read_script`

| Pattern | Detection | Severity |
|---------|-----------|----------|
| `get_node("../../..")` chains | regex `get_node\("(\.\./){2,}` | WARNING |
| Nodes without owner | check scene tree | CRITICAL |
| Duplicate names at same level | compare siblings | WARNING |
| `find_child()` deep search | grep in scripts | INFO |
| Long absolute @onready paths | grep `@onready.*get_node.*root` | WARNING |
| Missing class_name on referenced scripts | cross-ref scripts | INFO |
| Hardcoded resource paths | grep `load("res://` without export | INFO |

### Step 3: Generate Report

```
Scene Health Report: [scene_name].tscn
=====================================
Score: X/10

CRITICAL (must fix):
  - Description — node path or file reference

WARNINGS (should fix):
  - Description

INFO (consider):
  - Description

Summary:
  Nodes: N | Depth: N | Signals: N | Dependencies: N
  Estimated draw calls: N | Physics bodies: N
```

**Scoring:** Start at 10. Each CRITICAL: -2, each WARNING: -0.5. Minimum: 1.

### Step 4: Auto-Fix (if requested)

**Safe to auto-fix:**
- Duplicate signal connections: `mcp__godot-mcp-pro__disconnect_signal`
- Missing collision shapes: `mcp__godot-mcp-pro__setup_collision`
- Unnamed physics layers: `mcp__godot-mcp-pro__set_project_setting`
- Wrong property values: `mcp__godot-mcp-pro__update_property`
- Save after: `mcp__godot-mcp-pro__save_scene`

**Require human judgment (report only):**
- Node restructuring
- Signal rewiring
- Script refactoring
- Scene splitting

### Step 5: Re-Check

After fixes, re-run the suite to confirm resolution and catch regressions.

## Project Conventions

Check the project's .claude/skills/ and CLAUDE.md for project-specific health checks such as expected autoloads, entity system requirements, build script patterns, and coding standards.

## When to Run

- Before committing scene changes
- After large refactoring
- When starting work on an unfamiliar scene
- When experiencing unexplained issues
