# dotfiles

## Claude Code plugins

This repo is a Claude Code plugin marketplace. To subscribe, add to your `settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "emmahyde-dotfiles": {
      "source": {
        "source": "github",
        "repo": "emmahyde/dotfiles"
      }
    }
  },
  "plugins": {
    "discuss-and-execute@emmahyde-dotfiles": true
  }
}
```

### Available plugins

- **discuss-and-execute** — Interactive workflow for discussing implementation decisions, gathering codebase context, planning parallelizable task waves, and executing with coordinated agents.
- **my-voice-bot** — Generate a writing voice/style prompt for any GitHub user by mining their PR review comments.
- **search-conversations** — Search past Claude Code conversations across all projects by description, returning resume commands.
- **wispr** — Voice interaction with Claude Code via Wispr Flow dictation and macOS TTS.
- **review-canvas** — PR-style transcript review canvas: drag-select line ranges in a JSONL transcript, attach comments, and stream them into the running session as channel events.