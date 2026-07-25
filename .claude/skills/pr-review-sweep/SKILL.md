---
name: pr-review-sweep
description: >-
  Reviews PRs Pablo-style (proof-based, run-don't-guess), posting findings in
  Emma's voice. By default sweeps the daily Slack PR-review threads to find PRs
  needing review; given PR URLs (a single URL or `--urls a,b,c`) it skips Slack
  and reviews exactly those. Fans out to one reviewer per PR when there's more
  than one.
  <triggers>
    /pr-review-sweep, daily review sweep, review today's PRs, sweep slack
    for PRs, check the review threads, run the pr sweep, review these PRs,
    review this PR, --urls
  </triggers>
version: 0.1.0
---

# PR Review Sweep

Reads the daily PR-review threads in Slack, figures out which linked PRs still
need review, and reviews each new one the way Pablo reviews: read it
holistically, prove every hunch by actually running things, and report in a
tight three-section format. Findings are posted in Emma's voice, no bot
signature. No gremlins, no swarm — one careful reviewer.

## Arguments

Two modes:

- **Sweep mode (default)** — no args, or `--since` / `--channels`. Reads the
  Slack review threads to *find* the PRs that still need review, then reviews
  them. This is what you get when nothing else is specified.
- **Review-only mode** — one or more PR URLs are supplied directly, so Slack is
  skipped entirely and only those PRs are reviewed:
  - a single bare PR URL, or
  - `--urls <url>,<url>,...` — a comma-separated batch of PR URLs.

Flags:

- `--urls <url>,<url>,...`: review exactly these PRs; skip the Slack sweep.
- `--since <hours>`: override the lookback window (default 24). Sweep mode only.
- `--channels <id1,id2>`: override the channel list (default
  `C0ALGQCCHL7,C09QX29JEQ5`). Sweep mode only.

When more than one PR is in play — whether from `--urls` or from a sweep that
surfaced several — **fan out**: review the PRs in parallel, one subagent per
PR (see Step 4). A single PR is reviewed inline, no subagent.

## Step 1: Gather

If invoked with a bare PR URL or `--urls`, skip Slack entirely and go straight
to Step 2 with the list of supplied URLs (`[{url: <url>}, ...]`). Split `--urls`
on commas and trim whitespace.

Otherwise run the `slack-review-digest` mcx chain:

```bash
mcx run slack-review-digest --args '{"channel_ids":["C0ALGQCCHL7","C09QX29JEQ5"],"since_hours":24}'
```

Substitute `--channels`/`--since` overrides into the args JSON if given.
Parse the returned digest's `prs` array. Each entry is
`{url, repo, number, poster, blurb, channel_id}`. If `count` is 0, report
"No PRs found in review threads" for channels that matched, or "No daily
review thread found" for channels that didn't (see `generated_from`), and
stop.

## Step 2: Dedup against prior runs

State file: `~/.pr-review-sweep/reviewed.json` — a JSON map
`pr_url -> {head_sha, reviewed_at}`. Create the directory and an empty `{}`
file if missing.

For each PR in the digest:

```bash
gh pr view <url> --json headRefOid,state,author,headRefName
```

Keep `author.login` and `headRefName` around — Step 4b needs them to detect a
self-authored PR (`author.login == "emmahyde"`) and to know the branch to push.

- Skip (record as "closed/merged, skipped") if `state != "OPEN"`.
- Skip (record as "unchanged, skipped") if `headRefOid` equals the recorded
  `head_sha` for that URL in `reviewed.json` — it's already been reviewed at
  this exact commit, don't spam the PR on every sweep re-run.
- Otherwise it's a "new" PR to review (first time, or new commits since last
  review).

## Step 3: Get a local checkout you can run things in

A Pablo-style review runs tests / `rails runner` / `irb` and greps for callers
and patterns, so you need the repo on disk at the PR's head. Emma's repos live
in `~/work`; clone anything else into `~/workspace`.

For each "new" PR's `org/repo`, review from a **worktree at the PR head** so you
never disturb the working checkout:

```bash
BASE=~/work/<repo>; [ -d "$BASE/.git" ] || BASE=~/workspace/<repo>
if [ ! -d "$BASE/.git" ]; then gh repo clone <org>/<repo> "$BASE"; fi
git -C "$BASE" fetch origin
WT=$(mktemp -d)/<repo>-pr<number>
git -C "$BASE" worktree add "$WT" <headRefOid>
```

Work from `$WT`. Remove the worktree (`git -C "$BASE" worktree remove "$WT"`)
when the review is posted.

Note: for repos whose test suite needs the dev cluster rather than a local run
(e.g. your-app — see its `k8s-debug` skill), prove hunches via that path
(`kubectl`-driven `rails runner`) instead of assuming a local `bin/rails test`
works.

## Step 4: Review — proof-based, Pablo's method, Emma's voice

Each PR gets **one careful reviewer** — no swarm or gremlins *within* a single
review. But when there are multiple "new" PRs, fan the PRs out so they review
concurrently:

- **One PR:** review it inline yourself.
- **Multiple PRs:** dispatch one `Agent` (subagent_type `general-purpose`,
  model Sonnet) per PR, all in a single message so they run in parallel. Give
  each subagent its own PR URL, its already-resolved `org/repo/number` +
  `headRefOid` + `author.login` + `headRefName`, its worktree path from Step 3,
  and the full text of this Step 4 **and Step 4b** (checklist, voice,
  three-section format, the `gh api ... /reviews` post command, and the
  self-authored fix-push-respond-then-watch flow) so it reviews and posts
  exactly as described. When the PR is `emmahyde`'s, that same subagent performs
  Step 4b itself (fix, push, respond, then `/watch-pr-checks`) before returning.
  Each subagent returns its Step 6 line (findings count + blocking count) and its
  Step 5 record entry; you merge those centrally. Subagents post their own
  reviews — don't relay their findings back through yourself.

Whether inline or in a subagent, one PR review follows the same method.

Follow `review-checklist.md` (this skill's folder — it's Pablo's review
prompt). The non-negotiables:

- Read the PR holistically first: the diff, the description, and every existing
  comment (`gh pr view <url> --comments`) so you never re-raise something
  already being handled.
- Look past the diff — check the callers of every changed class/method for
  breakage, and whether the change fights the repo's established patterns.
- **Prove every hunch.** Don't post a suspicion; confirm it with a test,
  `rails runner`, `irb`, a query, or a repro, and show that proof in the
  finding. The *only* thing you may raise unverified is something you genuinely
  couldn't check yourself — and then you say why.
- Never write "likely" / "maybe" / "probably". Be sure.
- Queries: indexes (`EXPLAIN`), N+1, full scans, plucking large sets to memory.
- `find_by` that should be `find_by!`; nil guards that should alert, not
  swallow. Migration/deploy safety (migrations run before the code swap; column
  drops, non-batched backfills, payloads enqueued across deploy).
- Check CI (Buildkite / Bamboo MCP) for related failures before blaming the PR.

Then post, writing in Emma's voice (`voices/emma.md`) and Pablo's three-section
format (see that file's "Review output format"):

1. **What it does** — one short paragraph.
2. **Verdict** — ships as-is / needs changes / blocked on a question. Plain, no
   hedging.
3. **Findings** — each opening with one **bolded bracketed tag**, Pablo's
   original style: `**[blocking]**` / `**[follow-up]**` / `**[nit]**` /
   `**[info]**` / `**[check]**` / `**[question]**`. Only real findings; if there
   are none, "No findings." Back every real bug with the proof you gathered.

**Before posting, classify every finding — this is a required step, not a
default.** For each finding, get its `file:line` and check that line against
the PR's diff hunks (`gh pr diff <url> --patch`, or the hunk headers you
already read in Step 4). Two buckets only:
- **In the diff** (added/changed line, including any line in a wholly new
  file) → inline comment. This is the default outcome for most findings on
  most PRs — a review with a real finding and zero `comments[]` entries is a
  sign you skipped this step, not a sign the skill doesn't apply here.
- **Not in the diff** (a caller elsewhere, a pattern in unchanged code, a
  cross-cutting concern with no single line) → folds into the body's
  Findings list. This bucket exists for genuine exceptions, not as the
  default path because a single `-f body=` call is fewer steps than building
  `comments[]`.

Do not post the review until every finding has been sorted into one of the
two buckets above. `gh api .../reviews` accepts `comments[]` as repeated
`-F` flags — one call, not one call per comment.

Post the review body, then attach each finding as an inline comment at its
`file:line` when that line is in the diff, otherwise fold it into the body's
Findings list. Format the body as a **bulleted / sub-bulleted tree**, not
prose paragraphs — lead bullets for the two sections, sub-bullets for detail:

```markdown
- **What it does**
  - <one short summary of the problem and how it's solved>
- **Verdict:** ships as-is / needs changes / blocked on a question
  - <one sentence of why, if it isn't obvious>
- **Findings** (only those not posted inline; omit this bullet if all are inline)
  - **[blocking]** <finding + proof>
  - **[nit]** <finding + proof>
```

Each inline finding comment also leads with its bolded bracketed tag:

```bash
gh api repos/<org>/<repo>/pulls/<number>/reviews \
  -f event=COMMENT -f body="<bulleted tree: What it does + Verdict + any non-inline findings>" \
  -F 'comments[][path]=<file>' -F 'comments[][line]=<n>' \
  -F 'comments[][side]=RIGHT' -F 'comments[][body]=**[blocking]** <finding in Emma voice>'
```

No signature, no bot marker, no footer.

## Step 4b: If it's your own PR — fix, push, respond, then watch

Emma's GitHub login is `emmahyde`. Determine the PR author when you fetch its
state (`gh pr view <url> --json author,headRefOid,state`). A PR is "your own"
when `author.login == "emmahyde"`.

For a PR **you** authored, don't stop at posting the review — the findings are
your own notes to yourself, so act on them immediately:

1. Post the review exactly as in Step 4 (bulleted-tree body, bolded bracketed
   inline tags).
2. **Immediately dispatch a local subagent** (subagent_type `general-purpose`,
   model Sonnet) working in that PR's worktree from Step 3 to **fix, push, and
   respond**:
   - Apply the fix for each actionable finding (`blocking` / `follow-up` / `nit`
     — skip pure `info`; for `check` / `question`, only act if the answer is
     unambiguous, otherwise leave the comment for a human).
   - Commit and push to the PR's branch (`headRefName`).
   - Reply to each finding's comment thread saying what changed (Emma's voice,
     terse — "done", "fixed in <sha>", or a one-line why-not), and resolve it.
   - Return the new head SHA it pushed.
3. Once the fix commit is pushed, **start `/watch-pr-checks`** for that PR so CI
   and any new review comments are monitored. Invoke the `watch-pr-checks` skill;
   it also watches for new comments on the PR.

Never do this fix-and-push flow on a PR you did **not** author — for someone
else's PR you only post the review and stop. When the review fanned out to a
subagent (multiple PRs), that subagent posts the review and, if the PR is
`emmahyde`'s, performs steps 2–3 itself before returning.

## Step 5: Record

After each PR finishes review (whether or not you found anything),
update `~/.pr-review-sweep/reviewed.json`:

```json
{
  "<pr_url>": { "head_sha": "<headRefOid>", "reviewed_at": "<ISO8601 timestamp>" }
}
```

Merge into the existing map — don't clobber entries for other PRs.

## Step 6: Report

Print a concise summary:

```
Slack sweep: <channel> matched thread <ts> / no daily thread found
Found: N PRs across channels
Skipped (closed/merged): N
Skipped (unchanged since last review): N
Reviewed: N
  - <repo>#<number> — posted M findings (B blocking)
  - <repo>#<number> — no findings, ships as-is
Errors: N
  - <repo>#<number> — <error>
```

## Constraints

- Never post to a PR that's not OPEN.
- Never re-review a PR at a head SHA already recorded in `reviewed.json`.
- Never invent a Slack channel ID — only the two defaults or an explicit
  `--channels` override.
- When PR URLs are given (bare URL or `--urls`), never touch Slack — review
  only the supplied PRs. `--since`/`--channels` are ignored in that mode.
- Multiple PRs review in parallel (one subagent each); a single PR reviews
  inline. Dedup (Step 2) and record (Step 5) still apply per PR.
- If `gh` is unauthenticated, stop and say so — don't guess PR state.
- Never post an unproven finding. If you couldn't run it down, either don't
  post it or post it as `check`/`question` and say what you couldn't verify.
- No "likely" / "maybe" / "probably" in any posted comment.
- Never post a review with real findings and an empty `comments[]` without
  having explicitly checked each finding's `file:line` against the diff
  first (see the classification step in Step 4). Folding everything into
  the body is a decision per finding, not a default shortcut.
- Only run the Step 4b fix-push-respond-then-watch flow on a PR whose
  `author.login == "emmahyde"`. On anyone else's PR, post the review and stop —
  never push commits or reply-and-resolve on a PR you didn't author.
