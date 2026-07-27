# Example: Design Generation Surface

```
┌────────────────────────────────────────────────────────────┐
│ [Skill: web-prototype]  [Design system: Neutral Modern]    │
├────────────────────────────────────────────────────────────┤
│ Brief: "A settings page for a React app"                   │
├──────────────────────────┬─────────────────────────────────┤
│ Agent transcript / chat  │  Sandboxed iframe preview       │
│                          │  (live HTML artifact)           │
└──────────────────────────┴─────────────────────────────────┘
```

- **System prompt:** base contract + `DESIGN.md` + `SKILL.md`.
- **Output:** `<artifact>` tag parsed into an iframe.
- **Export:** HTML source, PDF, or handoff brief to a coding agent.
