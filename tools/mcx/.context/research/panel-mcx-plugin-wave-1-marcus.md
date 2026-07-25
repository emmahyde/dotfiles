# Panel: mcx Plugin Wave 1
## Marcus: token-economy and agent-DX

**Confidence:** MEDIUM
**Sources:** `bench/captures/get_jira_issue.json` (real RETIRE-15400 payload), `bench/captures/slack_to_bug.json` (real thread), `bench/README.md`, `.context/codebase/ARCHITECTURE.md`

## 1. Shipped `modifiers.json` defaults

Verified against the real capture in `bench/captures/get_jira_issue.json` — these fields
appear on every Jira issue response and carry zero decision-relevant signal:

| Tool | Path (dotted) | Action | Why it's safe |
|---|---|---|---|
| `getJiraIssue` / `searchJiraIssues` / `editJiraIssue` | `expand` | drop | Literal value `"renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations"` — a request-echo string, never consulted downstream. |
| same | `self` (at every nesting level: issue, `fields.project.self`, `fields.reporter.self`, `fields.status.self`, `fields.priority.self`, `fields.issuetype.self`) | drop | REST hypermedia link back to the API resource. The model never re-issues raw HTTP; it calls `mcx forward`/registered tools, which resolve their own URLs. |
| same | `fields.*.avatarUrls` (project, reporter) | drop | Four image-size variants (`48x48`/`24x24`/`16x16`/`32x32`) of an avatar the model can't render or act on. Confirmed present twice per issue (project + reporter) in the capture. |
| same | `fields.*.iconUrl` (issuetype, priority, status) | drop | Same category — a status/priority icon image URL, decorative only. |
| same | `fields.reporter.timeZone`, `fields.reporter.accountType`, `fields.reporter.active` | drop | Account metadata unrelated to the ticket's content; `displayName`/`emailAddress` (kept) already identify the reporter. |
| `searchJiraIssues` | `names`, `schema` (top-level, when `expand` requested them) | drop | Field-metadata dictionaries describing the *shape* of custom fields, not their values — pure schema noise duplicated across every result row. |

Explicitly **NOT** touched by the shipped defaults, because they are load-bearing:
`fields.description` (the ADF/markdown ticket body — the actual signal), `fields.summary`,
`fields.status.name`, `fields.priority.name`, `fields.labels`, `fields.components[].name`,
`key`, `id`, `fields.assignee`/`reporter.displayName`/`emailAddress`, `fields.created`/`updated`.

For Slack (`slack_to_bug.json` shape): no drop-only default proposed yet — the capture I
read is already a pre-digested thread transcript (from a chain), not a raw Slack API
response, so I have no verified raw-Slack cruft field to cite. Flag as a **gap**: ship the
Jira modifier set now; add a Slack/Notion modifier only once someone captures a *raw*
`conversations.replies` or Notion `blocks.children.list` payload and can point at a
concrete field (e.g. Slack's `blocks` Block-Kit layout tree, Notion's `id`-only rich-text
`annotations` defaults) — don't guess field names for the shipped defaults.

## 2. Making defaults safe by construction

- **Drop-only, no rename/truncate in the shipped file.** Rename can silently change a key
  the model was told to look for; truncate can cut mid-sentence and look like complete data
  (indistinguishable from "the ticket description really is one sentence long"). Reserve
  `truncate`/`rename` for user/project-authored modifiers where a human reviewed the effect.
- **Fail-open is the existing contract** (ARCHITECTURE.md state machine: "no match → pass
  through") — keep it, and additionally fail-open on *malformed* modifier entries (bad
  dotted path, unknown action) rather than erroring the tool call. A broken modifier must
  degrade to "no trim happened," never to "tool call failed."
  the ARCHITECTURE.md constraint says `updatedToolOutput` preserves the MCP content
  envelope, and this is the second half of that: the envelope survives even when the
  *reshape* logic inside it throws.
- **Escape hatch:** a `MCX_TRIM=off` env var (or `--no-trim` on `mcx trim` if invoked
  directly) that makes the PostToolUse hook a no-op — same shell-visible convention as
  `NO_COLOR`. Document it in the skill so an agent that gets a suspiciously-short payload
  and needs to check "is this actually all the data, or did trim eat something" has a one-line
  way to see the raw response before concluding data is missing.
- **Allow-list semantics, not block-list:** every dropped path in the shipped file must be
  named explicitly by dotted path (never a wildcard like `**.self`) so a future API version
  that reuses `self` for something meaningful doesn't get silently eaten. Slower to author,
  but it's the difference between "provably can't hide signal" and "probably doesn't."

## 3. Measuring trim without overstating

Trim and chains are different economy mechanisms and must not share one bench row:
chains eliminate the raw payload from context entirely (7x-99x, per bench/README.md);
trim only shrinks the payload that *does* enter context on ordinary tool calls that were
never candidates for a chain (a single `getJiraIssue` a human asked about directly).
Conflating them would overstate trim by borrowing chain's multiplier.

- **Add a trim-specific bench row**, same harness, same tokeniser (`tiktoken cl100k_base`
  via `count_tokens.py`), same real captures already in `bench/captures/`:
  for each capture, compute tokens(raw envelope) vs tokens(envelope with modifiers.json
  applied), report as `trim ratio` alongside the existing `space back` column — don't merge
  the two columns into one number.
- **Report on the recv side only.** Trim doesn't touch what the model *emits* (the tool-call
  args are unchanged), so folding it into the existing `context = emit + recv` metric
  without noting that would make trim look like it saves emit tokens it doesn't.
- **Use the real captures, not synthetic fixtures, for the published trim number** —
  `gen_fixtures.rb`'s synthetic payloads are sized to match real ones but their field
  *names* are lorem-generated stand-ins, so a modifier keyed on `self`/`avatarUrls` may not
  even match synthetic JSON, making the synthetic trim ratio meaninglessly optimistic (100%
  no-op) or meaninglessly pessimistic depending on how `gen_fixtures.rb` names keys. Verify
  which before trusting any synthetic trim number.
- Expect the honest number to be modest — single-digit percent-to-low-double-digit
  reduction per call, not chain-scale. The value case for trim is "context hygiene on every
  call, no authoring cost," not "matches chain's 99x." Don't let the two numbers sit in the
  same table implying comparable magnitude.

## 4. Steering toward chains over redundant MCP calls

Single mechanism: the **UserPromptSubmit `additionalContext` nudge**, already in the fixed
design — but scope it tightly to avoid the failure mode where it fires on every prompt and
gets tuned out:

- **Trigger condition, not blanket injection:** the hook should only add the chains nudge
  when the *previous turn's* tool-call history shows the pattern chains solve — 2+ calls to
  the same MCP tool in sequence (the fan-out case), or a call whose PostToolUse-observed
  response size exceeds a threshold even after trim. A hook that fires on unrelated prompts
  ("what does this function do") teaches the agent to skip the nudge text, which kills it
  for the prompts where it matters.
- **Content:** name the concrete registered chain (`mcx run <name>`) if one already matches
  the tool signature about to be called, not a generic "consider chaining" — concrete
  next-action text is far more likely to be taken than a philosophy reminder, and it costs
  the same context.
- **Anti-fatigue backstop:** rate-limit to once per N turns per session regardless of
  trigger re-firing (a stateful marker file, same pattern as chain/modifier config
  precedence — cheap, no new mechanism needed). Verify this against the actual hook
  implementation once written; I have not seen `hooks/hooks.json` yet, so this is a
  recommendation, not a confirmed existing behavior.

## 5. Top risk and protecting convention

**Top risk:** a modifier entry silently drops a field that looks like cruft in the
capture that motivated it but is load-bearing in a different response shape — e.g. `self`
is genuinely disposable on `fields.project.self`, but if a future Jira endpoint response
puts a real, no-other-source `id` value only inside a `self` URL param for some field mcx
hasn't seen yet, the drop-only default would quietly remove the only path to it, and
because trim fails open with no error, nothing would signal the loss — the agent just gets
a smaller-than-expected payload and might not notice.

**Protecting convention:** every shipped modifier entry is authored against a *named,
version-controlled real capture* checked into `bench/captures/` (or a redacted excerpt of
one in the modifier's own comment/adjacent doc) — never against field names recalled from
memory or written speculatively. Concretely: no entry ships in `modifiers.json` until
someone can point at `bench/captures/<file>.json:<path>` showing the exact field being
dropped and its value. This is the same discipline the codebase already uses for OAuth
(`expiresAt` epoch-ms verified against real keychain payload, not assumed) — apply it to
modifiers too. If a new MCP tool's response shape hasn't been captured yet, it gets no
modifier entry (fail-open covers it) rather than a guessed one.

**Gaps:**
- No verified raw Notion or Slack API payload was available in this pass (`slack_to_bug.json`
  is post-chain digest text, not raw API) — do not ship Notion/Slack modifier entries until
  one is captured.
- Hook rate-limiting mechanism for the UserPromptSubmit nudge is a recommendation; I have not
  read `hooks/hooks.json` (not yet written in this repo state) to confirm implementation
  feasibility.
- Did not verify whether `mcx trim`'s dotted-path matcher supports array-index or wildcard
  paths (needed for `fields.components[].name` preservation and per-item `self`/`avatarUrls`
  drops inside arrays like `components`) — confirm against the actual `mcx trim` implementation
  before finalizing the array-bearing entries in section 1.
