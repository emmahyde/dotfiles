#!/usr/bin/env bash
#
# SkillOpt plug-and-play bootstrap — run once. Idempotent.
#
# Installs the SkillOpt training loop and wires in the generic `skilldoc` env so
# any skill.md + cases.jsonl can be optimized with zero per-skill Python.
#
#   1. Clone microsoft/SkillOpt to $SKILLOPT_ROOT (default ~/.cache/skillopt/SkillOpt)
#   2. pip install it (editable)
#   3. Copy the bundled skilldoc env into skillopt/envs/skilldoc/
#   4. Copy the skilldoc config into configs/skilldoc/default.yaml
#   5. Register `skilldoc` in scripts/train.py (idempotent)
#   6. Report which credentials are still needed
#
# Usage:
#   bash bootstrap.sh                 # install + wire up
#   SKILLOPT_ROOT=/path bash bootstrap.sh
#
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="${SKILL_DIR}/assets"
SKILLOPT_ROOT="${SKILLOPT_ROOT:-${HOME}/.cache/skillopt/SkillOpt}"
REPO_URL="https://github.com/microsoft/SkillOpt"

log()  { printf '  %s\n' "$*"; }
ok()   { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*"; }
die()  { printf '❌ %s\n' "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }

clone_or_update() {
    if [ -f "${SKILLOPT_ROOT}/scripts/train.py" ]; then
        log "SkillOpt already present at ${SKILLOPT_ROOT}"
        return
    fi
    if [ -f /tmp/SkillOpt/scripts/train.py ] && [ ! -e "${SKILLOPT_ROOT}" ]; then
        log "reusing existing /tmp/SkillOpt → ${SKILLOPT_ROOT}"
        mkdir -p "$(dirname "${SKILLOPT_ROOT}")"
        cp -R /tmp/SkillOpt "${SKILLOPT_ROOT}"
        return
    fi
    log "cloning ${REPO_URL} → ${SKILLOPT_ROOT}"
    mkdir -p "$(dirname "${SKILLOPT_ROOT}")"
    git clone --depth 1 "${REPO_URL}" "${SKILLOPT_ROOT}"
}

pip_install() {
    if python3 -c 'import skillopt' >/dev/null 2>&1; then
        log "skillopt importable — skipping pip install"
        return
    fi
    log "pip installing skillopt (editable)"
    python3 -m pip install -e "${SKILLOPT_ROOT}" >/dev/null
}

install_env() {
    local dest="${SKILLOPT_ROOT}/skillopt/envs/skilldoc"
    mkdir -p "${dest}" "${SKILLOPT_ROOT}/configs/skilldoc"
    cp "${ASSETS}/skilldoc/"*.py "${dest}/"
    cp "${ASSETS}/skilldoc.config.yaml" "${SKILLOPT_ROOT}/configs/skilldoc/default.yaml"
    ok "skilldoc env + config installed"
}

register_env() {
    python3 - "$SKILLOPT_ROOT" <<'PY'
import sys, pathlib
root = pathlib.Path(sys.argv[1])
train = root / "scripts" / "train.py"
src = train.read_text()
if '"skilldoc"' in src:
    print("  skilldoc already registered in train.py")
    sys.exit(0)
marker = '"""Lazy-import built-in adapters'
i = src.index(marker)
nl = src.index("\n", i) + 1
block = (
    "    try:\n"
    "        from skillopt.envs.skilldoc.adapter import SkillDocAdapter\n"
    '        _ENV_REGISTRY["skilldoc"] = SkillDocAdapter\n'
    "    except ImportError:\n"
    "        pass\n"
)
train.write_text(src[:nl] + block + src[nl:])
print("  registered skilldoc in train.py")
PY
    ok "skilldoc registered"
}

report_creds() {
    printf '\n── Credentials ──────────────────────────────────────────\n'
    log "Default surface = Claude Code agentic loop:"
    log "  • rollouts use the \`claude\` CLI (your existing Claude Code auth — no key)"
    log "  • optimizer/judge uses openai_chat → needs OPENAI_API_KEY"
    log "    (the runner maps it to the AZURE_OPENAI_* names SkillOpt reads)"
    if [ -n "${OPENAI_API_KEY:-}" ]; then
        ok "OPENAI_API_KEY is set"
    else
        warn "OPENAI_API_KEY not set — export it (or pass --optimizer_backend claude_chat with ANTHROPIC_API_KEY)"
    fi
    command -v claude >/dev/null 2>&1 && ok "\`claude\` CLI on PATH" || warn "\`claude\` CLI not found — needed for claude_code_exec rollouts"
}

probe_optimizer() {
    # Fail-fast connectivity + model-id check so a wrong optimizer id surfaces
    # here, not 60s into a run. One ~30-token call. Non-fatal (warn only).
    [ -n "${OPENAI_API_KEY:-}" ] || { warn "skipping optimizer probe (no OPENAI_API_KEY)"; return; }
    local model
    # Read the optimizer model with a real YAML parser (skillopt depends on
    # PyYAML, installed by now) — robust to formatting the grep/sed idiom breaks on.
    model="$(python3 -c "import yaml,sys; print(yaml.safe_load(open('${SKILLOPT_ROOT}/configs/skilldoc/default.yaml')).get('model',{}).get('optimizer',''))" 2>/dev/null)"
    model="${model:-gpt-5.5}"
    log "probing optimizer round-trip (openai_chat, model=${model}) …"
    OPTIMIZER_PROBE_MODEL="$model" python3 - <<'PY' && ok "optimizer round-trip works" || warn "optimizer probe failed — check OPENAI_API_KEY / model id before a real run"
import os, sys
k = os.environ["OPENAI_API_KEY"]
os.environ.setdefault("AZURE_OPENAI_API_KEY", k)
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://api.openai.com/v1")
os.environ.setdefault("AZURE_OPENAI_AUTH_MODE", "openai_compatible")
os.environ["OPTIMIZER_DEPLOYMENT"] = os.environ.get("OPTIMIZER_PROBE_MODEL", "gpt-5.5")
try:
    import skillopt.model.backend_config as bc
    bc.OPTIMIZER_BACKEND = "openai_chat"
    from skillopt.model import chat_optimizer_messages
    _out, usage = chat_optimizer_messages(
        [{"role": "user", "content": "Reply with the single token: OK"}],
        max_completion_tokens=16, stage="probe",
    )
    sys.exit(0 if usage.get("total_tokens", 0) > 0 else 1)
except Exception as e:
    print(f"    {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
    sys.exit(1)
PY
}

main() {
    require git
    require python3
    log "SkillOpt root: ${SKILLOPT_ROOT}"
    clone_or_update
    pip_install
    install_env
    register_env
    report_creds
    probe_optimizer
    printf '\n'
    ok "Bootstrap complete. SKILLOPT_ROOT=${SKILLOPT_ROOT}"
    log "Next: python3 ${ASSETS}/skilldoc_run.py --skill SKILL.md --cases cases.jsonl"
}

main "$@"
