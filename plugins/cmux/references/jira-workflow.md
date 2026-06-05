# Jira Ticket Resolution

Shared step used by both `spin-off` and `minion` skills.

## Prerequisites

Requires `acli`. If not installed:

```bash
brew tap atlassian/homebrew-acli && brew install acli
acli jira auth login --web
```

## Workflow

### If a ticket ID was provided (`[A-Z]+-[0-9]+`)

Validate it exists and extract the summary:

```bash
acli jira workitem view {TICKET_ID} --json
```

Then assign and transition using the `transition-ticket` script in the plugin's `scripts/` directory (two levels up from `${CLAUDE_SKILL_DIR}`):

```bash
plugin_dir=$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)
"${plugin_dir}/scripts/transition-ticket" {TICKET_ID}
```

### If creating a new ticket

Prefer the `gusto-essentials:create-jira-ticket` skill if it is installed — it handles ADF formatting and gathers details interactively. After it creates the ticket, run transition on the returned key:

```bash
plugin_dir=$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)
"${plugin_dir}/scripts/transition-ticket" {TICKET_KEY}
```

If `gusto-essentials:create-jira-ticket` is not available, fall back to:

```bash
acli jira workitem create \
  --project "{PROJECT}" \
  --type "{issue_type}" \
  --summary "{title}" \
  --description "{description}" \
  --assignee @me \
  --json
```

Extract the ticket key from the JSON output, then transition:

```bash
plugin_dir=$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)
"${plugin_dir}/scripts/transition-ticket" {TICKET_KEY}
```

### If no ticket desired

Ask the user for a branch name to use instead. Skip the transition step.

## Output

After this step you should have:

- `TICKET_ID` — the ticket key (e.g., `RETIRE-9202`)
- `TICKET_URL` — `https://gustohq.atlassian.net/browse/{TICKET_ID}`
- `TICKET_SUMMARY` — the ticket's summary/title

Report the ticket key and URL to the user before proceeding.
