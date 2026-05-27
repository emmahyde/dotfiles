---
name: gh-similar-repos
description: Search GitHub for repositories similar to a given repo, topic, or tech stack — a "you might also like" recommendation engine. Use this skill whenever the user asks to find similar repos, discover alternatives, explore an ecosystem, or says anything like "things like this", "what else is like X", "find repos similar to Y", "alternatives to Z", "recommend repos for [topic]", or "what should I look at next?" in a GitHub/OSS context. Trigger even when the input is vague — a description or keyword is enough.
---

# GitHub Similar Repos

Find repositories similar to a given input using `gh` CLI + GraphQL. Works from a repo slug, a URL, a topic, or a plain description.

## 1. Parse Input

Determine what you received:

| Input type | Example | Action |
|---|---|---|
| Repo slug / URL | `godotengine/godot` | Fetch metadata first (step 2) |
| Topic/keyword | `"react state management"` | Skip to step 3 |
| Stack description | `"C# game framework like MonoGame"` | Skip to step 3, derive query |

## 2. Fetch Source Repo Metadata (if given a slug/URL)

Extract topics, language, and description:

```bash
gh api graphql -f query='
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    description
    primaryLanguage { name }
    repositoryTopics(first: 10) {
      nodes { topic { name } }
    }
    stargazerCount
  }
}' -f owner="OWNER" -f name="NAME"
```

Pull out: topics array, language name, notable words from description. These become your search signals.

## 3. Build Search Queries

Run 2–3 passes with different query shapes — single signals cast wide, combinations filter down.

**Important:** GitHub's search API requires *all* `topic:` filters to co-occur on a single repo. Multi-topic queries often return 0 results even for common topics. Lead with single-signal passes; use multi-topic only as a tighter final pass.

Recommended sequence:
1. `topic:FOO language:LANG -repo:owner/name` — single topic + language (most reliable)
2. `KEYWORD_PHRASE language:LANG stars:>50` — keyword fallback when topics are sparse
3. `topic:FOO topic:BAR language:LANG` — tight multi-topic pass (may return 0; that's OK)

```bash
gh api graphql -f query='
query($q: String!) {
  search(query: $q, type: REPOSITORY, first: 25) {
    nodes {
      ... on Repository {
        nameWithOwner
        description
        stargazerCount
        forkCount
        isArchived
        primaryLanguage { name }
        repositoryTopics(first: 6) {
          nodes { topic { name } }
        }
        url
        pushedAt
      }
    }
    repositoryCount
  }
}' -f q="QUERY_STRING"
```

Query construction tips:
- For keyword inputs: use `"phrase"` for exact matches, otherwise space-separated terms
- Add `NOT mirror:true` for niche searches to filter forks-of-forks
- Add `stars:>100` if results are noisy
- If a pass returns 0 results, drop one constraint (remove a topic, relax language, lower star floor)

## 4. Supplement with Ecosystem Knowledge

GitHub topics are often sparse or missing — the API alone will miss well-known repos. After collecting API results, mentally cross-check: are there canonical projects in this space that didn't surface? If you know of clearly relevant repos (e.g., the de-facto standard library, a well-known fork, a widely-cited alternative), include them and note they came from ecosystem knowledge rather than search. Don't pad — only add ones you're confident are relevant.

## 5. Score & Rank

Deduplicate across search passes (and any knowledge-supplemented additions), then score each result:

| Signal | Points |
|---|---|
| Each matching topic | +3 |
| Matching primary language | +2 |
| Description keyword overlap | +1 per word |
| Very low stars (<10) | −2 |
| Archived repo | −3 |
| No recent activity (>2 years) | −1 |

Sort descending. Aim to surface 5–10 solid results.

## 6. Present Recommendations

Format as a ranked list with reasons. Group by theme if there's a natural split (e.g., "Same ecosystem", "Alternative approach", "Adjacent tooling").

```
## Repos like [input]

**[input description or source repo link]**

---

1. **owner/repo** ⭐ 12,400
   C# · game-engine · cross-platform
   > One-line description from GitHub
   **Why:** shares topics [game-engine, opengl], same language (C#)
   https://github.com/owner/repo

2. **owner/repo2** ⭐ 8,200
   ...
```

At the end, add a one-sentence "Why these?" summary explaining what signals drove the recommendations — useful when the user wants to search further.

## Fallback

If `gh api graphql` fails (auth, quota), fall back to REST:

```bash
gh api "/search/repositories?q=QUERY&sort=stars&per_page=20"
```

Parse `.items[]` similarly (topics come from a separate call: `gh api /repos/OWNER/NAME/topics`).

## Edge Cases

- **No topics on source repo:** rely on language + description keywords; mention this to the user
- **Very popular repo (>50k stars):** the "similar" space may be sparse; broaden to adjacent topics
- **Vague input ("something like React"):** ask one clarifying question — language preference? frontend/backend? — before running
- **User wants depth, not breadth:** re-run with tighter topic filters and raise the stars floor
