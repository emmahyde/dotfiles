# comment-cleanup

Aggressively prune comments from source code so every remaining comment earns its place.

## What it does

Applies a strict "earn-your-place" doctrine: the default action for any comment is DELETE. A comment survives only if it explains a *why* the code can't show, warns of a non-obvious consequence, points outside the file, documents a public API contract, is an actionable `TODO`/`FIXME`, or disambiguates something genuinely ambiguous.

Runs two ways:

- **Audit mode** — hand it an existing file and ask it to clean up, prune, or strip AI-flavored comments.
- **Self-invocation** — hooks track files where you (Claude) just added or changed comment lines, then block turn-end until you've run the cleanup pass on them.

## When to use

- Reviewing or cleaning up LLM-generated code.
- After writing or editing code that adds comments — the hooks trigger this automatically.
- A file has narrator, translator, tutorial-stepper, or changelog-graffiti comments.

## Install

```
/plugin install comment-cleanup@guideline-plugin-marketplace
```
