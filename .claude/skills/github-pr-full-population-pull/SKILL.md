---
name: github-pr-full-population-pull
description: "Use when a task needs the COMPLETE set of GitHub PRs for an author/repo/date-range (not just a recent sample) and the internal pr:// resource is the first tool reached for — it silently caps at ~100 rows and ignores limit/date params without any error, so a naive read looks complete but isn't."
---

## Symptom

`pr://<org>/<repo>?author=<login>&state=all&limit=<N>` (any N) returns at most ~100 rows, and those rows are always the *newest* slice — increasing `limit` or trying to page further back does nothing. There is no truncation warning; the response looks like a complete, well-formed answer. If you only skim the row count without checking the actual date span covered, you will silently under-report the population (e.g. reporting "100 PRs over 6 months" when the true window covered is 5 weeks and the true population is 5x larger).

## Detection

Always sanity-check the *date range actually covered* by a `pr://` result against the date range you asked for, not just the row count. If the oldest row's `created_at` doesn't reach back to your requested start date, you have hit the cap, not the true boundary.

## Fix: authenticated GitHub Search API with real pagination

```bash
# One page (max 100 rows); repeat with page=2,3,... until a page returns fewer than per_page rows
gh api "search/issues?q=repo:ORG/REPO+author:LOGIN+is:pr+created:START..END&per_page=100&page=1&sort=created&order=asc"
```

This hits the GitHub *Search* API rate-limit bucket (30 req/min), which is separate from and far less restrictive than an unauthenticated `github.com/search` web scrape (which 429s almost immediately for repeated/broad queries). For a large population, fetch pages sequentially and concatenate `items`; each page's `total_count` field tells you the true population size up front, so you can compute how many pages you need.

## Cross-verify

When the `xd://github` MCP tool is mounted, re-run the same author/repo/date query with its `search_prs` op (note: it may itself cap at 50 results per call, but should return a real subset that reconciles with the `gh api` numbers on overlap) as an independent confirmation that the `gh api` pull is not itself wrong. Two independent channels agreeing is much stronger evidence than trusting either alone, especially after discovering one channel (`pr://`) was silently lossy.

## Reporting

When correcting a prior undercount, don't overwrite the original evidence — append a dated "Update" section noting the root cause (tooling cap, not a true data boundary), the corrected total, and where the full corrected dataset now lives. If the correction also requires re-classifying the newly-recovered rows, do it with the *same* method as the original classification and say so explicitly if you can't reproduce a manual/hand-reviewed pass at the same fidelity (e.g. an automated regex retriage is directional evidence, not a replacement for a hand-reviewed classification).
