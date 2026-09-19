---
name: audit-bot-pr-human-touch-rate
description: "Use when asked how many bot-authored (e.g. Dependabot) GitHub PRs in a repo/window actually required human code intervention vs. were pure merge-click toil — e.g. to size a PR auto-merge automation's real target population."
---

# Audit bot-PR human-touch rate

Answers: "of N bot-authored PRs in this window, how many needed a human to actually write code vs. were safe to auto-merge as-is?"

## Step 1 — Pull the real bot population, not a human author's population

Check the automation's actual trigger condition (e.g. `pr_author: dependabot[bot]`) and query exactly that author, never a human author whose PRs merely relate to the same topic (dependency bumps authored by a human are a different population from bot-authored bumps — conflating them is a common, easy-to-make error).

```bash
gh api "search/issues?q=repo:OWNER/REPO+author:dependabot%5Bbot%5D+is:pr+created:START..END&per_page=100&page=N&sort=created&order=asc" > page_N.json
```

Space calls ~10-45s apart — `gh api search/issues` hits a secondary/burst rate limit distinct from the primary 30/min search quota, even well under quota.

## Step 2 — Batch-check commit authorship via GraphQL, not per-PR REST calls

One GraphQL query can check ~45 PRs' commits at once via aliases:

```graphql
query {
  repository(owner: "OWNER", name: "REPO") {
    p12345: pullRequest(number: 12345) {
      number
      commits(first: 30) {
        totalCount
        nodes { commit { author { user { login } } } }
      }
    }
    p12346: pullRequest(number: 12346) { ... }
  }
}
```

Write the query to a file and call it with `-F` (not `-f` — `-f`/`--raw-field` takes values literally; only `-F`/`--field` resolves the `@file` magic-read syntax):

```bash
gh api graphql -F query=@/tmp/batch.graphql > /tmp/batch.json
```

Batch ~45 aliases per call (well under GraphQL complexity limits), one call per ~45 PRs, spaced ~10s apart.

## Step 3 — Enumerate ALL distinct commit authors before classifying — do not assume one bot name is the only automation identity

```python
all_authors = set()
for pr in results.values():
    all_authors |= {n["commit"]["author"]["user"]["login"] for n in pr["commits"]["nodes"] if n["commit"]["author"]["user"]}
print(sorted(all_authors))  # eyeball this — look for CI/service accounts beyond the obvious bot
```

In one real case, `ghe-automation-bamboo-production` (a CI service account that auto-pushes lockfile-sync commits on top of the bot's own bump commit) was present on ~90% of PRs and would have been miscounted as "human involvement" if only the obvious bot login were excluded. Build the exclusion set from this eyeballed list, not from assumption:

```python
KNOWN_AUTOMATION = {"ghe-automation-bamboo-production"}  # extend per-repo as discovered

def is_bot_login(login):
    return login is None or "dependabot" in login.lower() or login in KNOWN_AUTOMATION

human_touched = {pr: any(not is_bot_login(a) for a in authors) for pr, authors in ...}
```

## Result shape

Report: total bot PRs, count with zero human commits (pure merge-click toil — the real auto-merge-tool target), count with a human commit (genuine engineering, out of scope for any merge-automation feature), and which humans/how often (sanity-check for one person carrying disproportionate load).
