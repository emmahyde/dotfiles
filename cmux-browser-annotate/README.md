# cmux-browser-annotate

![](https://github.com/user-attachments/assets/3a565fae-34aa-4b67-8de6-c13c1130d79d)

A drawing and annotation overlay for [cmux](https://cmux.dev) browser surfaces. Draw on any webpage, select DOM elements, and pass references back to your AI assistant.

## Quick Install

```sh
curl -sL https://raw.githubusercontent.com/emmahyde/dotfiles/master/cmux-browser-annotate/install.sh | sh
```

Or clone and run locally:

```sh
git clone https://github.com/emmahyde/dotfiles.git
./dotfiles/cmux-browser-annotate/install.sh
```

## Usage

**Ctrl+D** toggles annotation mode. Once active, all tools are plain key presses:

| Key | Tool | Description |
|-----|------|-------------|
| F | [F]reehand | Draw freehand strokes |
| A | [A]rrow | Click and drag to draw arrows |
| S | [S]hape | Click and drag to draw ellipses |
| T | [T]ext | Click to place text (Shift+Enter for multiline, Enter to commit) |
| H | [H]ighlight | Click DOM elements to select them; click again to deselect |

| Key | Action |
|-----|--------|
| Z | Undo |
| R | Redo |
| C | Copy selected elements to clipboard |
| Q | Clear all annotations |

```
# example [C]opy from above video scenario - copies the refs to the "Highlighted" eleements.

[sel 1] <rect> selector="div#eligibility > svg > g > rect:nth-of-type(3)" text="" rect=67,353,680x119
[sel 2] <rect> selector="div#eligibility > svg > g > rect:nth-of-type(2)" text="" rect=67,420,864x265
[sel 3] <rect> selector="div#eligibility > svg > g > rect:nth-of-type(1)" text="" rect=737,427,657x261
```

The toolbar in the top-right corner also has clickable tool buttons and a color picker:

<img width="489" height="88" alt="Screenshot 2026-04-09 at 11 36 26 AM" src="https://github.com/user-attachments/assets/8e92015f-31c6-493a-bc4b-f57aad39c200" />

### Implicit Move

Hover near any annotation to see a grab cursor. Click and drag to reposition it. Works in every mode except Highlight.

### Element Selection

In Highlight mode, click elements to select them. Each gets a numbered orange outline and a `data-sel` attribute on the DOM node. Press **C** to copy all selections to clipboard in a format that includes CSS selectors, text content, and bounding boxes.

Your AI assistant can also read selections programmatically:

```sh
cmux browser eval 'JSON.stringify(window.__annotateOverlay.getSelections())'
```

## Auto-inject on Browser Open

Source the wrapper in your shell config to auto-inject when opening browsers:

```sh
# In ~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish
source ~/work/dotfiles/cmux-browser-annotate/cmux-browser.sh
```

Then use `cmux-browser open <url>` instead of `cmux browser open`.

## Files

| File | Purpose |
|------|---------|
| `browser-annotate.js` | The annotation overlay (injected into browser pages) |
| `install.sh` | One-shot installer for all active browser surfaces (also works via curl) |
| `cmux-browser.sh` | Shell wrapper that auto-injects on `cmux-browser open` |
| `inject-annotate.sh` | Standalone injection script (legacy, use `install.sh` instead) |

## How It Works

The overlay is a full-page `<canvas>` element positioned absolutely over the document. Annotations are stored in page coordinates so they scroll natively with content (no JS redraw on scroll). The script is registered as a cmux `addinitscript` so it persists across page navigations within the same browser surface.
