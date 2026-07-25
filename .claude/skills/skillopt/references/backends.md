# Backends & credentials

Choose `model.backend`, then verify the matching credentials are present **before
leaving Phase 2**. Confirm against the user's shell env (the user can run
`! printenv NAME` to check without exposing the value to you in logs).

| `model.backend` | What it is | Required env / config |
|---|---|---|
| `azure_openai` | Azure OpenAI (recommended) | `AZURE_OPENAI_ENDPOINT` (always required). Auth: either `AZURE_OPENAI_API_KEY`, **or** `AZURE_OPENAI_AUTH_MODE=azure_cli` (no key — uses `az login`). |
| `openai_chat` | OpenAI direct | `OPENAI_API_KEY` |
| `claude_code_exec` | Anthropic Claude via the Claude CLI | `ANTHROPIC_API_KEY`; `claude` on PATH (`model.claude_code_exec_path`). |
| `qwen` | Local Qwen via vLLM | `QWEN_CHAT_BASE_URL` (e.g. `http://localhost:8000/v1`), `QWEN_CHAT_MODEL`. |

> `AZURE_OPENAI_ENDPOINT` is non-negotiable for Azure — without it every LLM call
> fails. State this plainly if the user picks Azure.

## Optimizer vs target — the split to teach
- **target** = the model that *does the task* during rollout (forward pass).
- **optimizer** = the model that *reflects on failures and rewrites the skill*
  (backprop). Quality of the trained skill comes mostly from here.
- They can use different models and even different Azure resources
  (`optimizer_azure_openai_*` / `target_azure_openai_*`). Common cost move:
  strong optimizer, cheaper target.

## Per-role overrides
Only reach for `optimizer_azure_openai_endpoint` / `target_azure_openai_endpoint`
(and their `_api_key` / `_auth_mode` siblings) when the two roles live on
separate deployments. Otherwise the single `model.azure_openai_*` block applies
to both.

## Setup path
```bash
cp .env.example .env   # edit with credentials
source .env
pip install -e .                 # core
pip install -e ".[alfworld]"     # + alfworld benchmark (then: alfworld-download)
pip install -e ".[webui]"        # + monitoring dashboard
```
