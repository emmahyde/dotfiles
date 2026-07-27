# Dispatch

You never dispatch unprompted. Write the prompt file, present the rationale, then **offer**. Run only after the user says yes.

---

## Claude models → native Agent tool

```
Agent({
  description: "<3-5 words>",
  subagent_type: "general-purpose",
  model: "fable" | "opus" | "sonnet" | "haiku",
  prompt: "<contents of the generated prompt file>",
  run_in_background: true
})
```

Notes
- `model` accepts the short alias, not the full API id.
- Effort and thinking are session-level, not Agent-tool parameters. If the generated prompt depends on a specific effort rung, say so in the offer ("run this at `max` effort") rather than pretending the tool sets it.
- Fable/Opus tasks can run many minutes. Background is the default and the right choice.
- Paste the prompt file's contents into `prompt` — the subagent does not read your conversation.

## Non-Claude models → deleg8

Real signature (`mcp__deleg8__spawn`):

```
{
  agent_id?: string,            // ^[a-zA-Z0-9_.\-]{1,64}$ — auto-generated if omitted
  background?: boolean,         // default false; true returns immediately
  cwd?: string,                 // working directory for the omp subprocess
  extra_args?: string[],
  initial_prompt?: string,      // first prompt sent after spawn
  model?: { provider: string, modelId: string },   // set_model frame sent before initial_prompt
  role?: "leaf",                // prepends a no-sub-delegation preamble
  rpc_mode?: "rpc" | "rpc-ui",  // default rpc-ui: routes dialogs to MCP elicitation
  timeout_ms?: number           // default 300000
}
```

Standard call for a generated prompt:

```
mcp__deleg8__spawn({
  agent_id: "<model>-<topic-slug>",
  model: { provider: "<from the profile>", modelId: "<from the profile>" },
  role: "leaf",
  background: true,
  cwd: "<repo root, if the task touches files>",
  initial_prompt: "<contents of the generated prompt file>"
})
```

Notes
- `role: "leaf"` unless the prompt deliberately asks the model to fan out. Most single-artifact prompts should be leaf.
- `background: true` whenever the model has a deep-only thinking gear (DeepSeek, GLM) or the artifact is large — otherwise you burn the 300s default timeout. If you do run in the foreground, raise `timeout_ms` to match the expected depth.
- Completion arrives as `<channel source="deleg8" agent_id="X" event="agent_end">`. Retrieve with `mcp__deleg8__output`, check liveness with `mcp__deleg8__status`, resume an idle agent with `mcp__deleg8__send`.
- Do not pass credentials or `extra_args` you have not verified.

---

## The offer

Two lines, after the rationale:

```
Run it? — <Agent tool | deleg8 spawn> → <provider/modelId or alias>, background, ~<expected duration>.
Or say "sweep" to run the same prompt at two effort rungs and diff the results.
```

Offer the sweep only when the target model actually has more than one usable rung (see the low-gear rule in `deleg8-models.md`).
