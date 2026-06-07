#!/usr/bin/env bash
#
# run-skillopt-default.sh — SkillOpt with the skill's baked-in defaults:
#   target / rollout fan-out : a ton of cheap deepseek-v4-flash agents
#   optimizer / judge        : Gemini 3.5 Flash
#
# DeepSeek is OpenAI-API-compatible, so it rides the built-in `openai_chat`
# backend via a custom base URL. Gemini is NOT built in — register a one-time
# `gemini_chat` backend first (copy the minimax template; see
# references/deepseek-flash-default.md). Keeping the judge on its own backend
# avoids any OPENAI_* key collision with the DeepSeek target.
#
# Usage:
#   run-skillopt-default.sh <config.yaml> [split_dir] [extra train.py args...]
#
# Example:
#   run-skillopt-default.sh configs/searchqa/default.yaml data/my_split --num_epochs 4
#
# Env (set these, or put them in .env and `source .env` first):
#   DEEPSEEK_API_KEY   API key for DeepSeek (the rollout target)
#   GEMINI_API_KEY     API key for Gemini  (the optimizer / judge)
# Optional overrides:
#   TARGET_MODEL       (default: deepseek-v4-flash)
#   OPTIMIZER_MODEL    (default: gemini-3.5-flash)
#   WORKERS            (default: 64)   parallel rollout workers — "a ton of agents"
#   BATCH_SIZE         (default: 64)   tasks rolled out per step
#   NUM_EPOCHS         (default: 4)
#   DEEPSEEK_BASE_URL  (default: https://api.deepseek.com/v1)
#   GEMINI_BASE_URL    (default: https://generativelanguage.googleapis.com/v1beta/openai/)

set -euo pipefail

main() {
    if [[ $# -lt 1 ]]; then
        sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'
        exit 1
    fi

    local config="$1"; shift
    local split_dir=""
    if [[ $# -gt 0 && "$1" != --* ]]; then
        split_dir="$1"; shift
    fi

    : "${DEEPSEEK_API_KEY:?Set DEEPSEEK_API_KEY (the rollout target's key)}"
    : "${GEMINI_API_KEY:?Set GEMINI_API_KEY (the Gemini 3.5 Flash judge's key)}"

    local target_model="${TARGET_MODEL:-deepseek-v4-flash}"
    local optimizer_model="${OPTIMIZER_MODEL:-gemini-3.5-flash}"
    local workers="${WORKERS:-64}"
    local batch_size="${BATCH_SIZE:-64}"
    local num_epochs="${NUM_EPOCHS:-4}"
    local deepseek_base_url="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/v1}"
    local gemini_base_url="${GEMINI_BASE_URL:-https://generativelanguage.googleapis.com/v1beta/openai/}"

    # openai_chat backend (the DeepSeek target) reads OPENAI_API_KEY / OPENAI_BASE_URL.
    # This remap is scoped to the exec'd child process; your shell env is unaffected.
    echo "[run-skillopt-default] Remapping OPENAI_API_KEY/OPENAI_BASE_URL → DeepSeek for this run only" >&2
    export OPENAI_API_KEY="$DEEPSEEK_API_KEY"
    export OPENAI_BASE_URL="$deepseek_base_url"
    # gemini_chat backend (the judge) reads GEMINI_API_KEY / GEMINI_BASE_URL.
    export GEMINI_API_KEY
    export GEMINI_BASE_URL="$gemini_base_url"

    # base_url reaches the openai_chat backend via OPENAI_BASE_URL above; no per-role
    # flag is passed because only `qwen_chat` documents one. batch_size defaults to 64
    # for wider DeepSeek exploration — set BATCH_SIZE=40 for paper-equivalent runs.
    local -a cmd=(
        python scripts/train.py
        --config "$config"
        --target_backend openai_chat
        --target_model "$target_model"
        --optimizer_backend gemini_chat
        --optimizer_model "$optimizer_model"
        --workers "$workers"
        --batch_size "$batch_size"
        --num_epochs "$num_epochs"
        --out_root "outputs/deepseek-flash-$(basename "${config%.*}")"
    )
    [[ -n "$split_dir" ]] && cmd+=(--split_dir "$split_dir")
    cmd+=("$@")

    echo "[run-skillopt-default] target=$target_model x${workers} workers | judge=$optimizer_model" >&2
    exec "${cmd[@]}"
}

main "$@"
