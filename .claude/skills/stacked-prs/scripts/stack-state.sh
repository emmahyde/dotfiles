#!/usr/bin/env bash
# Single source of truth for "what is this stack's state". Prints a human table by
# default, or normalized JSON with --json. Never writes to the remote.
set -uo pipefail

MODE="${1:-table}"

emit_fail() {
  if [ "$MODE" = "--json" ]; then
    printf '{"ok":false,"reason":"%s","remedy":"%s"}\n' "$1" "$2"
  else
    printf 'STACK: none — %s\nREMEDY: %s\n' "$1" "$2"
  fi
  exit "${3:-2}"
}

command -v gh >/dev/null 2>&1 || emit_fail "gh not installed" "brew install gh" 3
command -v jq >/dev/null 2>&1 || emit_fail "jq not installed" "brew install jq" 3
gh extension list 2>/dev/null | grep -q 'gh-stack' \
  || emit_fail "gh-stack extension not installed" "gh extension install github/gh-stack" 3

git rev-parse --git-dir >/dev/null 2>&1 || emit_fail "not a git repository" "cd into a repo" 3

trunk=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null); trunk="${trunk#origin/}"
trunk="${trunk:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)}"
trunk="${trunk:-main}"

raw=$(gh stack view --json 2>/dev/null); rc=$?
if [ "$rc" -eq 2 ] || [ -z "$raw" ]; then
  cur=$(git branch --show-current 2>/dev/null)
  base=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null)
  if [ -n "$base" ] && [ "$base" != "$trunk" ]; then
    emit_fail "branch '$cur' has a PR based on '$base' but no tracked stack" \
      "gh stack checkout <pr-number>, or gh stack link $base $cur" 4
  fi
  emit_fail "branch '$cur' is not part of a stack" "gh stack init, or gh stack checkout" 2
fi
[ "$rc" -ne 0 ] && emit_fail "gh stack view failed (rc=$rc) — auth or API error, NOT proof of no stack" \
  "gh auth status, then retry. Do not force-push on this result." 5

# gh-stack v0.1.0 `base` is the trunk SHA the stack was cut from, not the parent
# branch; the parent chain exists only as array position, so derive it from the index.
norm=$(printf '%s' "$raw" | jq -c --arg trunk "$trunk" '
  def pr: (.pullRequest // .pr // null);
  (.trunk // $trunk) as $t
  | (.branches // []) as $bs
  | {
    ok: true,
    trunk: $t,
    currentBranch: (.currentBranch // ($bs | map(select(.isCurrent)) | first | (.name // .branch))),
    conflictBranch: (.conflictBranch // null),
    branches: [ $bs | to_entries[] | .key as $i | .value | {
      branch:       (.name // .branch),
      parent:       (if $i == 0 then $t else ($bs[$i - 1] | (.name // .branch)) end),
      baseSha:      ((.base // .baseRefName // "") | tostring | .[0:8]),
      prNumber:     (pr | if . == null then null else (.number // .prNumber) end),
      prState:      (pr | if . == null then null else (.state // .status // null) end),
      draft:        (.draft // (pr | if . == null then null else .draft end) // false),
      needsRebase:  (.needsRebase // false),
      isMerged:     (.isMerged // false),
      isQueued:     (.isQueued // false),
      isCurrent:    (.isCurrent // false)
    } ]
  }
  | .depth  = (.branches | length)
  | .active = [ .branches[] | select(.isMerged == false and .isQueued == false) ]
  | .unsubmitted = [ .branches[] | select(.prNumber == null and .isMerged == false) | .branch ]
  | .stale  = [ .branches[] | select(.needsRebase) | .branch ]
  | .merged = [ .branches[] | select(.isMerged) | .branch ]
  | .queued = [ .branches[] | select(.isQueued) | .branch ]
')

git fetch --quiet origin "$trunk" 2>/dev/null
behind=$(git rev-list --count "HEAD..origin/$trunk" 2>/dev/null || echo 0)

slug=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
squash_only=$(gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed \
  -q '(.squashMergeAllowed and (.mergeCommitAllowed|not) and (.rebaseMergeAllowed|not))' 2>/dev/null)
has_queue=false
if [ -n "$slug" ]; then
  has_queue=$(gh api graphql -f query="{repository(owner:\"${slug%%/*}\",name:\"${slug##*/}\"){mergeQueue{id}}}" \
    --jq '.data.repository.mergeQueue != null' 2>/dev/null || echo false)
fi

# Every true condition is listed, not just the winner: a stack is routinely both
# behind trunk AND unsubmitted, and reporting one hides real work. MERGED_MIDSTACK
# ranks first because a squash commit is in no child's history — descendants are broken.
conds=$(printf '%s' "$norm" | jq -c --argjson behind "${behind:-0}" '
  [ (if (.conflictBranch != null)                            then "CONFLICT|gh stack rebase --continue (or --abort)" else empty end),
    (if ((.merged|length) > 0 and (.active|length) > 0)       then "MERGED_MIDSTACK|gh stack sync --prune" else empty end),
    (if ((.stale|length) > 0)                                 then "STALE|gh stack rebase, then gh stack push" else empty end),
    (if ($behind > 0)                                         then "TRUNK_MOVED|gh stack sync" else empty end),
    (if ((.unsubmitted|length) > 0)                           then "UNSUBMITTED|gh stack submit" else empty end),
    (if ((.branches|length) > 0 and (.active|length) == 0)    then "ALL_LANDED|gh stack sync --prune" else empty end) ]
  | if length == 0 then ["CLEAN|gh stack merge"] else . end')

# Squash + merge queue reproducibly ejects child PRs with invalid_merge_commit
# (github/gh-stack discussions#223); the queue validates a child against a base
# that lacks the parent's squash. Land those stacks one PR at a time.
if [ "$squash_only" = "true" ] && [ "$has_queue" = "true" ]; then
  conds=$(printf '%s' "$conds" | jq -c '. + ["SQUASH_QUEUE_RISK|land one PR at a time, not the whole stack"]')
fi
verdict=$(printf '%s' "$conds" | jq -r '.[0]')
also=$(printf '%s' "$conds" | jq -r '.[1:] | map(split("|")[0]) | join(", ")')

if [ "$MODE" = "--json" ]; then
  printf '%s' "$norm" | jq -c --argjson behind "${behind:-0}" --argjson conds "$conds" \
    --arg v "${verdict%%|*}" --arg n "${verdict#*|}" \
    --arg sq "${squash_only:-unknown}" --arg mq "${has_queue:-unknown}" \
    '. + {trunkBehind:$behind, verdict:$v, nextCommand:$n,
          squashOnly:$sq, hasMergeQueue:$mq,
          conditions:($conds | map(split("|")[0]))}'
  exit 0
fi

printf 'STACK  trunk=%s  depth=%s  trunk-behind=%s  squash-only=%s  merge-queue=%s\n' \
  "$(printf '%s' "$norm" | jq -r .trunk)" \
  "$(printf '%s' "$norm" | jq -r .depth)" "${behind:-0}" \
  "${squash_only:-unknown}" "${has_queue:-unknown}"
printf '%s' "$norm" | jq -r '
  "",
  (["", "BRANCH", "PR", "STATE", "PARENT", "FLAGS"] | @tsv),
  (.branches | to_entries[] |
    [ (if .value.isCurrent then "->" else "  " end),
      .value.branch,
      (if .value.prNumber then "#\(.value.prNumber)" else "-" end),
      (.value.prState // "no-pr"),
      (.value.parent // "-"),
      ([ (if .value.isMerged then "merged" else empty end),
         (if .value.isQueued then "queued" else empty end),
         (if .value.needsRebase then "NEEDS-REBASE" else empty end),
         (if .value.draft then "draft" else empty end) ] | join(",") | if . == "" then "ok" else . end)
    ] | @tsv)' | column -t -s "$(printf '\t')"
printf '\nVERDICT: %s\nNEXT:    %s\n' "${verdict%%|*}" "${verdict#*|}"
[ -n "$also" ] && printf 'ALSO:    %s\n' "$also"
exit 0
