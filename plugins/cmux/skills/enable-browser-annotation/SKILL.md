---
description: "Inject the cmux browser annotation overlay (draw, highlight DOM elements, copy selectors) into active cmux browser surfaces. Use when asked to 'annotate the browser', 'inject the overlay', 'turn on browser annotations', 'highlight DOM elements in cmux', or invoked as '/enable-browser-annotation'."
user-invocable: true
---

# Browser Annotate

Inject the drawing + DOM-selection overlay into a cmux browser surface so the user can draw on pages, select elements, and copy CSS selectors back to Claude.

## Prerequisites

- At least one cmux browser surface open (`cmux browser open <url>`).
- The bundled `browser-annotate.js` ships in `${CLAUDE_PLUGIN_DIR}/assets/`.

## Process

### Step 1: Determine target surface

Parse the user's request:

- If they specify a surface ref (`surface:N`), use it directly.
- Otherwise auto-discover all active browser surfaces via `cmux tree --all`.

### Step 2: Inject

Run the installer shipped with this plugin:

```bash
"${CLAUDE_PLUGIN_DIR}/assets/enable-browser-annotation.sh" [surface:N]
```

With no argument, the script enumerates every active browser surface and injects into each one. With a surface ref, it injects only that surface.

The script registers `browser-annotate.js` as a cmux `addinitscript` (so it persists across navigations) and immediately evaluates it on the current page.

### Step 3: Report

Tell the user:

- Which surface(s) the overlay was injected into.
- **Ctrl+D** toggles annotation mode.
- Tools (once active): `F` freehand, `A` arrow, `S` shape, `T` text, `H` highlight DOM elements, `Z` undo, `R` redo, `C` copy selections, `Q` clear.

## Reading selections programmatically

To pull the user's element selections back into the agent:

```bash
cmux browser eval 'JSON.stringify(window.__annotateOverlay.getSelections())'
```

Returns an array of `{selector, text, rect}` entries — one per highlighted element.

## Auto-inject on browser open (optional)

For the user's shell config:

```sh
source "${CLAUDE_PLUGIN_DIR}/assets/cmux-browser.sh"
```

Then `cmux-browser open <url>` injects on open. (`cmux-browser.sh` expects `browser-annotate.js` to live alongside it inside the plugin's `assets/` dir.)
