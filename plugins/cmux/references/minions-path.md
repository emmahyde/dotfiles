# Minions Path Resolution

Shared step used by both `spin-off` and `minion` skills.

## Resolution process

Run the resolver script:

```bash
plugin_dir=$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)
minions_path=$("${plugin_dir}/scripts/resolve-minions-path")
```

If the script exits 0, `minions_path` is set and you can proceed.

If the script exits non-zero (path not found at any known location), ask the user:

> "Where is your Gusto/minions repo checked out? (e.g., `~/work/guideline/minions`)"

Expand the path (resolve `~`) and verify the directory exists before proceeding.

## Validation

After resolving the path, verify it contains the scripts the skill needs:

- `spin-off` skill: `{minions_path}/scripts/worktree/create`
- `minion` skill: `{minions_path}/scripts/minions/implement`

If either is missing, warn the user that the minions repo may be outdated or incorrectly located.
