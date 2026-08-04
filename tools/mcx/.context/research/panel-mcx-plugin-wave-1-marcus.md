# Token-economy and safe-default guidance

## Separate the two savings mechanisms

Filters reduce the receive side of an ordinary MCP call. Chains keep intermediate MCP payloads out
of model context altogether. Report these mechanisms separately:

- **Filter ratio:** tokens in the filtered response divided by tokens in the source response.
- **Chain ratio:** emitted plus received chain context divided by emitted plus received native
  context.

Do not compare them as though they provide the same kind of saving.

## Safe shipped filters

Shipped rules are drop-only and list exact dotted paths. They may remove transport or presentation
metadata such as `expand`, `self`, `avatarUrls`, or `iconUrl` only when a synthetic fixture proves
the path exists and nearby signal remains available.

Do not ship wildcard removals. Upstream schemas can reuse a familiar field name with different
semantics, and a wildcard would silently remove that new data.

Keep content-bearing fields such as summaries, descriptions, status names, labels, components,
assignees, timestamps, page text, message text, and spreadsheet values unless a user-authored rule
explicitly says otherwise.

## Synthetic fixtures

Published fixtures contain no captured tenant data. Use stable placeholders:

- issue key: `PROJ-123`
- URL host: `example.invalid`
- UUID: `00000000-0000-0000-0000-000000000001`
- page, channel, project, and spreadsheet IDs: obvious caller-supplied labels

Each shipped rule points to a matching synthetic fixture. Tests assert that removal paths exist and
that an allowlist of signal fields survives.

## Benchmark method

Generate fixtures deterministically, feed the same ordered payloads to native and chain scenarios,
and count compact JSON with one tokenizer. Run chains through the normal executor and replay
`forward()` calls from the fixture queue.

Publish methodology and retained fractions without presenting synthetic measurements as production
traffic. Fixture size, structure, seed, and tokenizer belong beside any reported result.

## Steering

Recommend a chain only after observing actual repeated MCP calls or an unfiltered response above
the configured threshold. Name a matching chain when one exists. Keep recommendations factual and
rate-limited so unrelated prompts remain unaffected.

## Review checklist

- Full keys follow `mcp__<alias>__<tool>`.
- Aliases are limited to `jira`, `notion`, `slack`, `gdocs`, and `gsheets`.
- Filters fail open.
- Chains require caller arguments and expose only the emitted digest.
- Fixtures and examples contain synthetic identifiers only.
