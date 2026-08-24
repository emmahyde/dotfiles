#!/usr/bin/env bash
# UserPromptSubmit: wipe per-prompt gate counters, then emit the preflight
# reminder that keeps comment discipline inside the model's attention window.
set -u
in=$(cat)
sid=$(jq -r '.session_id // ""' <<<"$in" 2>/dev/null || true)
[ -n "$sid" ] && rm -rf "${TMPDIR:-/tmp}/claude-comment-budget/$sid" 2>/dev/null
printf 'COMMENT PREFLIGHT (before typing any // # or docstring): delete first — write only if the comment explains WHY / warns of a non-obvious consequence / points outside the file for a removal condition, unavoidable vendor constraint, or external contract / documents a public API contract (inputs, outputs, errors, non-obvious failure modes) / is a TODO/FIXME/HACK with owner + problem + action carrying a ticket that identifies the removal condition / disambiguates units on a bare number, a magic constant, or an intentionally empty catch. One line by default; multi-line only for real caller-facing contracts or non-local operational constraints; scope to the changed construct only; no internal repo pointers; no provenance ("Added/Per review/V2/see STATE"); no narration ("loop through"/"increment i"/"constructor"/"getter"); no history URLs (PR/commit links); ticket refs only in TODO/FIXME/HACK marking a removal condition, not ordinary task or history references.'
exit 0
