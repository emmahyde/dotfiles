# Example: Plan Review Surface

```
┌────────────────────────────────────────────────────────────┐
│ Plan: Add OAuth2 login          [Approve] [Request changes] │
├──────────┬───────────────────────────────┬─────────────────┤
│ 1. Setup │                               │ 💬 Annotations  │
│ 2. Login │   # Implementation Plan       │ ─────────────── │
│ 3. Token │                               │ @ line 12       │
│          │   ## 1. Database migration    │ "use refresh    │
│          │                               │  tokens, not    │
│          │   Add a `refresh_tokens`      │  long-lived"    │
│          │   table...                    │                 │
│          │                               │ @ line 34       │
│          │   ## 2. API routes            │ "missing rate   │
│          │                               │  limit"         │
│          │   POST /auth/login            │                 │
└──────────┴───────────────────────────────┴─────────────────┘
```

- **Hook:** `ExitPlanMode` → open surface → block → return approve/feedback.
- **Artifact:** markdown plan in center.
- **Decision:** Approve or request changes.
- **Feedback:** inline annotations mapped back to plan lines.
- **Architecture:** thin Claude Code adapter + generic surface.
