---
description: This skill should be used when executing GSD phases, after "phase complete", "gsd-tools.cjs phase complete", or after a phase verification passes. Provides the procedure for pushing GSD phase state to Linear as part of the GSD execution workflow.
version: 0.1.0
---

## Purpose

After completing a GSD phase (verification passed, roadmap updated), push the phase outcome to Linear. This keeps Linear in sync with GSD state without requiring manual intervention.

## When to Apply

Apply this skill at two points in the GSD execute-phase workflow:

1. **Phase planned** — when `gsd-tools.cjs init execute-phase` confirms a phase directory exists and plans are loaded. Creates the Linear issue and todos.
2. **Phase complete** — after `gsd-tools.cjs phase complete` runs successfully. Posts completion comment and marks issue Done.

## Procedure

### On Phase Planned (before wave 1 executes)

Check whether the phase already has a Linear issue:

```bash
node -e "
const fs = require('fs');
const sync = JSON.parse(fs.readFileSync('.planning/linear-sync.json', 'utf8') || '{}');
const phases = sync.phases || {};
console.log(phases['PHASE_NUMBER'] ? 'exists' : 'missing');
"
```

If `missing`, invoke the `gsd-linear:linear-syncer` agent:

> "Create a Linear issue for Phase {N} — {phase-name}. Phase is being planned, not yet complete."

The agent creates the issue, adds plan todos, and updates `linear-sync.json`.

### On Phase Complete

After `gsd-tools.cjs phase complete` succeeds and ROADMAP.md is updated, invoke the `gsd-linear:linear-syncer` agent:

> "Phase {N} — {phase-name} just completed with verification status {passed/gaps_found}. Post the completion comment and mark the Linear issue Done."

The agent posts the comment, updates status, and marks todos complete.

### If linear-sync.json Missing

If `.planning/linear-sync.json` does not exist, skip silently. The user can run `/gsd-linear:sync` at any time to set up the integration and back-fill existing phases.

Do not block phase execution if Linear sync fails. Log the failure as a warning and continue.

## Integration Point in execute-phase

In the execute-phase workflow, these calls fit at:
- **After `validate_phase` step** → create issue if missing
- **After `update_roadmap` step** → post completion and mark Done

Both are non-blocking. Phase execution must complete regardless of Linear sync outcome.
