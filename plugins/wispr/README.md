# wispr-voice

Voice interaction with Claude Code via [Wispr Flow](https://wispr.com) dictation and macOS TTS.

## Install

```
claude plugin install wispr-voice@gusto-claude-code
```

## Setup

Run `/wispr:setup` for an interactive wizard that configures everything. Or do it manually:

### Step 1: Install and activate

After installing, relaunch Claude Code or run `/reload-plugins`.

### Step 2 (optional): Premium voices

For higher-quality TTS, install a Premium voice in System Settings → Accessibility → Spoken Content → System Voice → Manage Voices. Download any voice marked "Premium". Then set it in `~/.claude/wispr-config.yml`:

```yaml
wispr_voice: Zoe
```

Or run `/wispr:setup` and it will guide you through this.

### Step 3: Start the monitor

Run `/wispr:on`. Stop with `/wispr:off`.

### Step 4: Speak

Dictate into Wispr starting with your trigger word (default: `claude`). For example: "Claude, what time is it?" The trigger word is stripped before the text reaches Claude.

## How it works

- **`/wispr:on`** — starts `monitor.sh` via the Monitor tool
- **`/wispr:off`** — stops the monitor
- **`/wispr:setup`** — interactive setup wizard
- **`scripts/monitor.sh`** — polls Wispr Flow DB, applies trigger word filtering, emits matching transcriptions to stdout
- **`speak.sh`** — speaks text aloud via macOS `say`
- **`remind-speak.sh` (Stop hook)** — blocks Claude from ending its turn if the user spoke via Wispr but hasn't received an audio reply
- **`mark-speak.sh` (PostToolUse hook)** — tracks when `speak.sh` was last invoked so `remind-speak.sh` can compare against the last dictation timestamp

## Config file

`~/.claude/wispr-config.yml` is created automatically on first run:

```yaml
trigger_word: claude
# wispr_app:
# wispr_voice: Samantha
# elevenlabs_voice_id: 21m00Tcm4TlvDq8ikWAM
# elevenlabs_model: eleven_turbo_v2_5
```

Set `trigger_word` to any word to gate the monitor, or leave it empty to forward all dictations.

## TTS providers

Auto-selected. If `ELEVENLABS_API_KEY` is set in the environment, `speak.sh` uses ElevenLabs. Otherwise it uses macOS `say`. On any ElevenLabs failure (network error, non-200, missing curl/afplay) it falls back to `say`.

## Env vars

| Env var | Default | Description |
|---|---|---|
| `WISPR_VOICE` | config → `Samantha` | macOS `say` voice |
| `WISPR_APP` | config → all apps | Filter to one app's dictations by bundle ID |
| `WISPR_POLL_INTERVAL` | `0.5` | DB poll frequency in seconds |
| `ELEVENLABS_API_KEY` | unset | When set, switches TTS to ElevenLabs |
| `WISPR_ELEVENLABS_VOICE_ID` | config → `21m00Tcm4TlvDq8ikWAM` | ElevenLabs voice ID |
| `WISPR_ELEVENLABS_MODEL` | config → `eleven_turbo_v2_5` | ElevenLabs model ID |
