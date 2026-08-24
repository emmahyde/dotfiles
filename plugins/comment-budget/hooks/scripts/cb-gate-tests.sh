#!/usr/bin/env bash
set -u

GATE=$(dirname "$0")/cb-gate.sh
PASS=0; FAIL=0

make_input() {
  local content="$1" session="${2:-test-$$-$RANDOM}"
  jq -nc --arg c "$content" --arg s "$session" \
    '{tool_name:"Edit",session_id:$s,tool_input:{file_path:"test.js",new_string:$c}}'
}

make_input_path() {
  local path="$1" content="$2" session="${3:-test-$$-$RANDOM}"
  jq -nc --arg p "$path" --arg c "$content" --arg s "$session" \
    '{tool_name:"Edit",session_id:$s,tool_input:{file_path:$p,new_string:$c}}'
}

make_write_input() {
  local path="$1" content="$2" session="${3:-test-$$-$RANDOM}"
  jq -nc --arg p "$path" --arg c "$content" --arg s "$session" \
    '{tool_name:"Write",session_id:$s,tool_input:{file_path:$p,content:$c}}'
}

make_multiedit_per_path() {
  local path="$1" content="$2" session="${3:-test-$$-$RANDOM}"
  jq -nc --arg p "$path" --arg c "$content" --arg s "$session" \
    '{tool_name:"MultiEdit",session_id:$s,tool_input:{edits:[{file_path:$p,old_string:"",new_string:$c}]}}'
}

make_multiedit_top_path() {
  local path="$1" content="$2" session="${3:-test-$$-$RANDOM}"
  jq -nc --arg p "$path" --arg c "$content" --arg s "$session" \
    '{tool_name:"MultiEdit",session_id:$s,tool_input:{file_path:$p,edits:[{old_string:"",new_string:$c}]}}'
}

make_multiedit_mixed_paths() {
  local session="${1:-test-$$-$RANDOM}"
  jq -nc --arg s "$session" \
    '{tool_name:"MultiEdit",session_id:$s,tool_input:{edits:[
      {file_path:"docs/example.js",old_string:"",new_string:"// Added for RETIRE-1234"},
      {file_path:"src/mixed.js",old_string:"",new_string:"// Added for RETIRE-1234"}
    ]}}'
}

check() {
  local label="$1" input="$2" want="$3"
  local out
  out=$(printf '%s' "$input" | bash "$GATE" 2>/dev/null)
  if [ "$want" = deny ]; then
    if printf '%s' "$out" | grep -q '"deny"'; then
      printf 'PASS: %s\n' "$label"; PASS=$((PASS+1))
    else
      printf 'FAIL: %s (expected deny, got allow)\n' "$label"; FAIL=$((FAIL+1))
    fi
  else
    if printf '%s' "$out" | grep -q '"deny"'; then
      printf 'FAIL: %s (expected allow, got deny)\n' "$label"; FAIL=$((FAIL+1))
    else
      printf 'PASS: %s\n' "$label"; PASS=$((PASS+1))
    fi
  fi
}

check_reason() {
  local label="$1" input="$2" want="$3" out reason
  out=$(printf '%s' "$input" | bash "$GATE" 2>/dev/null)
  reason=$(jq -r '.hookSpecificOutput.permissionDecisionReason // ""' <<<"$out" 2>/dev/null)
  case "$reason" in
    *"$want"*) printf 'PASS: %s\n' "$label"; PASS=$((PASS+1)) ;;
    *) printf 'FAIL: %s (missing reason: %s)\n' "$label" "$want"; FAIL=$((FAIL+1)) ;;
  esac
}
check_bounded_retry() {
  local session="bounded-$$-$RANDOM" input out1 out2 out3
  input=$(make_input '// Added for RETIRE-1234
function bounded() {}' "$session")
  out1=$(printf '%s' "$input" | bash "$GATE" 2>/dev/null)
  out2=$(printf '%s' "$input" | bash "$GATE" 2>/dev/null)
  out3=$(printf '%s' "$input" | bash "$GATE" 2>/dev/null)
  if printf '%s' "$out1" | grep -q '"deny"' &&
     printf '%s' "$out2" | grep -q '"deny"' &&
     ! printf '%s' "$out3" | grep -q '"deny"'; then
    printf 'PASS: bounded fail-open after two denials\n'; PASS=$((PASS+1))
  else
    printf 'FAIL: bounded fail-open after two denials\n'; FAIL=$((FAIL+1))
  fi
}

check_bounded_retry

check "narration: loop through" \
  "$(make_input '// loop through users
function process(users) { return users; }')" deny

check "narration: loops over" \
  "$(make_input '// loops over items in the array
function scan(arr) { return arr.map(x => x); }')" deny

check "narration: increment i (translation)" \
  "$(make_input 'for (let i = 0; i < n; i++) { // increment i
  process(i);
}')" deny

check "narration: increment standalone" \
  "$(make_input 'count++;
// increment
return count;')" deny

check "narration: constructor label" \
  "$(make_input '// constructor
class Foo { constructor() {} }')" deny

check "narration: getter label" \
  "$(make_input '// getter
get value() { return this._v; }')" deny

check "allow: 4-line contract block (@param/@return)" \
  "$(make_input '// @param users  - list of user objects to filter
// @param opts   - optional config; opts.maxAge filters by age
// @returns      filtered user array (empty array, not null, on no match)
// @throws       ValidationError if opts.maxAge is negative
function filterUsers(users, opts) { return users; }')" allow

check "allow: 5-line operational-constraint block" \
  "$(make_input '// Must be called after db.connect() — connection pool is not lazily initialised.
// Caller owns the returned transaction and MUST call tx.rollback() on any error
// to release the advisory lock acquired here; failure causes deadlock under concurrent
// writers. The lock key is derived from schema_version, not table names.
// @returns Transaction object with advisory lock held
function beginMigration(db) { return db.tx(); }')" allow

check "allow: TODO with PR text ref" \
  "$(make_input '// TODO(team): remove after RETIRE-1234 merges, see PR #456
function legacyCompat() { return null; }')" allow

check "deny: FIXME with PR URL" \
  "$(make_input '// FIXME: tracked at https://github.com/org/repo/pull/789 — fix lands in next release
function brokenPath() { return undefined; }')" deny

check "allow: HACK with JIRA ref" \
  "$(make_input '// HACK: workaround for See JIRA PLAT-999 — remove after platform team ships fix
function patchedBehavior() { return true; }')" allow

check "deny: See JIRA without TODO" \
  "$(make_input '// See JIRA TICKET-123
function foo() { return 1; }')" deny

check "deny: See PR without TODO" \
  "$(make_input '// See PR #456
function bar() { return 2; }')" deny

check "deny: See commit without TODO" \
  "$(make_input '// See commit abc1234
function baz() { return 3; }')" deny

check "allow: WHY starting with We before loop" \
  "$(make_input '// We loop through twice to handle bidirectional dependency ordering
function resolve(deps) { return deps; }')" allow

check "deny: 8-line clean comment block" \
  "$(make_input '// This function validates the user token against the database
// It first checks the token signature using the shared secret
// Then it looks up the user record in the users table
// It verifies the user is not locked out or suspended
// It checks the users role permissions against the requested action
// If any check fails it returns a 401 or 403 as appropriate
// If all checks pass it returns the user record to the caller
// This is the main authentication entry point for all API requests
function authenticate(token) { return null; }')" deny

check "allow: 7-line clean comment block" \
  "$(make_input '// @param token    - JWT string from Authorization header
// @param action   - permission key being requested (e.g. "read:users")
// @param context  - request context for audit logging
// @returns        user record on success
// @throws         AuthError(401) when token is invalid or expired
// @throws         AuthError(403) when role lacks the requested permission
// @throws         DatabaseError on connection failure (caller should retry)
function authenticate(token, action, context) { return null; }')" allow

check "deny: 4-line block with banner" \
  "$(make_input '// ================================
// Authentication helpers
// ================================
// Added for PLAT-42
function helpers() {}')" deny

check "skip: docs/ path with banned content" \
  "$(make_input_path 'docs/api.js' '// Added for RETIRE-1234
function foo() {}')" allow

check "skip: generated/ path with banned content" \
  "$(make_input_path 'src/generated/schema.ts' '// Step 1: initialize schema
const schema = {};')" allow

check "deny: provenance in triple-single-quote docstring" \
  "$(make_input "def load():
    '''
    Added for v2.0 refactor
    '''
    return None")" deny

check "allow: clean content in triple-single-quote docstring" \
  "$(make_input "def load():
    '''
    Returns the cached record by ID, or None if not found.
    '''
    return None")" allow

check "allow: See RFC reference in comment" \
  "$(make_input '// See RFC 7231 §6.5.4 for the semantics of this status code
function notFound() { return 404; }')" allow

check "deny: uppercase provenance" \
  "$(make_input '// ADDED for sprint planning
function upperCaseProvenance() {}')" deny

check "deny: bare SHA history reference" \
  "$(make_input '// See c3a7b29f for the original design rationale
function shaHistory() {}')" deny

check "deny: version-tag compare URL" \
  "$(make_input '// See https://github.com/org/repo/compare/v1.0.0...v2.0.0
function tagHistory() {}')" deny

check "deny: compact PR reference" \
  "$(make_input '// See PR#456
function compactHistory() {}')" deny

check "allow: fused SeePR identifier" \
  "$(make_input '// SeePR#456 is the generated parser state identifier
function parserState() {}')" allow

check "deny: C-style inline narration" \
  "$(make_input 'count++; /* increment i */
return count;')" deny

check "deny: no-space inline narration" \
  "$(make_input 'i++// increment i
return i;')" deny

check "allow: shell URL path with narration-like text" \
  "$(make_input_path 'script.sh' 'curl https://example.com/api// increment i')" allow

check "deny: banned content without session id" \
  "$(jq -nc --arg c '// Added for RETIRE-1234
function missingSession() {}' \
    '{tool_name:"Edit",tool_input:{file_path:"test.js",new_string:$c}}')" deny

check "deny: Write content payload" \
  "$(make_write_input 'src/new.js' '// Added for RETIRE-1234
function writePayload() {}')" deny

check "deny: per-edit-path MultiEdit payload" \
  "$(make_multiedit_per_path 'src/multi.js' '// Added for RETIRE-1234
function multiPayload() {}')" deny

check "deny: top-level-path MultiEdit payload" \
  "$(make_multiedit_top_path 'src/top.js' '// Added for RETIRE-1234
function topLevelPayload() {}')" deny

check "deny: later source entry after excluded docs entry" \
  "$(make_multiedit_mixed_paths)" deny

check "deny: isolated maxprov block" \
  "$(make_input '// Added validation
// Fixed regression
// Updated parser
// Removed fallback
function maxprovOnly() {}')" deny

check "allow: clean content without session id" \
  "$(jq -nc --arg c 'function cleanMissingSession() {}' \
    '{tool_name:"Edit",tool_input:{file_path:"test.js",new_string:$c}}')" allow

check "deny: uppercase isolated maxprov block" \
  "$(make_input '// ADDED validation
// FIXED regression
// UPDATED parser
// REMOVED fallback
function uppercaseMaxprov() {}')" deny

check "deny: internal repository docs pointer" \
  "$(make_input '// See docs/protocol.md#handshake
function internalPointer() {}')" deny

check "deny: internal docs pointer inside TODO" \
  "$(make_input '// TODO(team): see docs/protocol.md after RETIRE-1234
function todoInternalPointer() {}')" deny

check "deny: branch compare URL" \
  "$(make_input '// See https://github.com/org/repo/compare/main...feature-branch
function branchHistory() {}')" deny

check "deny: PR reference at end of line" \
  "$(make_input '// See PR
function eolHistory() {}')" deny

check "deny: mixed-case commit reference" \
  "$(make_input '// sEe CoMmIt ABCDEF12
function mixedCaseHistory() {}')" deny

check "deny: no-space C-style narration" \
  "$(make_input 'count++;/* increment i */
return count;')" deny

check_reason "reason: maxprov category" \
  "$(make_input '// Added validation
// Fixed regression
// Updated parser
// Removed fallback')" \
  "Comment block of 4 consecutive lines"

check_reason "reason: internal pointer category" \
  "$(make_input '// See docs/protocol.md#handshake')" \
  "Internal repository pointer in comment"

check_reason "reason: per-edit path context" \
  "$(make_multiedit_per_path 'src/context.js' '// Added for RETIRE-1234')" \
  "src/context.js"

check "deny: Vue source extension" \
  "$(make_input_path 'src/App.vue' '// Added for RETIRE-1234
const component = {}')" deny

check "allow: empty Edit content" \
  "$(make_input '')" allow

printf '\nResults: %d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
