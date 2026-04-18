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