# HTML Output Specification

## Design principles

Dark theme as default. No border-radius on anything. Information-dense. System font stack. Sharp, clean, professional.

Support light theme via `prefers-color-scheme` media query, but design dark-first.

## Color palette

```css
:root {
  --bg: #111111;
  --surface: #1a1a1a;
  --surface2: #222222;
  --surface3: #2a2a2a;
  --border: rgba(255,255,255,0.12);
  --border-strong: rgba(255,255,255,0.20);
  --text: #e8e8e8;
  --text2: rgba(255,255,255,0.60);
  --text3: rgba(255,255,255,0.40);
  --accent: #5E9FE8;
  --accent-soft: rgba(94,159,232,0.12);
  --green: #72BC8F;
  --green-soft: rgba(114,188,143,0.12);
  --orange: #DE9255;
  --orange-soft: rgba(222,146,85,0.12);
  --red: #E97366;
  --red-soft: rgba(233,115,102,0.12);
  --purple: #BF8EDA;
  --purple-soft: rgba(191,142,218,0.12);
  --yellow: #EAC26B;
  --yellow-soft: rgba(234,194,107,0.12);
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #FFFFFF;
    --surface: #F9F8F7;
    --surface2: #F0EFED;
    --surface3: #E6E5E3;
    --border: #E6E5E3;
    --border-strong: #D0CFCD;
    --text: #2C2C2B;
    --text2: #7D7A75;
    --text3: #A0A0A0;
    --accent: #2783DE;
    --accent-soft: #E5F2FC;
    --green: #46A171;
    --green-soft: #E8F1EC;
    --orange: #D5803B;
    --orange-soft: #FBEBDE;
    --red: #E56458;
    --red-soft: #FCE9E7;
    --purple: #9B6FBF;
    --purple-soft: #F0E8F5;
    --yellow: #C49E30;
    --yellow-soft: #FBF4E0;
  }
}
```

## Typography

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  color-scheme: light dark;
  -webkit-font-smoothing: antialiased;
}
```

- Headings: weight 600, letter-spacing -0.01em
- H1: 26px. H2: 20px. H3: 16px
- Monospace: `ui-monospace, SFMono-Regular, Menlo, monospace`

## Shape

Zero border-radius on everything. Every corner is sharp. Borders: `1px solid var(--border)`. Focus outlines: `2px solid var(--accent)` with `2px` offset.

## Components

### Section panel

```html
<section class="panel">
  <h2 class="panel-title">Title</h2>
  <div class="panel-body">...</div>
</section>
```

```css
.panel { background: var(--surface); border: 1px solid var(--border); padding: 20px; margin-bottom: 12px; }
.panel-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; letter-spacing: -0.01em; }
```

### Data table

```css
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.data-table th {
  background: var(--surface2); color: var(--text2);
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border-strong);
}
.data-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.data-table tbody tr:hover { background: var(--surface2); }
```

### Details panel

```html
<details class="detail-panel">
  <summary>Title <span class="badge green">Recommended</span></summary>
  <div class="detail-body">...</div>
</details>
```

```css
.detail-panel { border: 1px solid var(--border); margin-bottom: 8px; }
.detail-panel summary {
  padding: 12px 16px; font-weight: 600; cursor: pointer; color: var(--accent);
  display: flex; align-items: center; gap: 8px;
}
.detail-panel summary:hover { background: var(--surface2); }
.detail-body { padding: 16px; border-top: 1px solid var(--border); }
```

### Status pill

```css
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; padding: 2px 8px; border: 1px solid transparent;
}
.pill.green { background: var(--green-soft); color: var(--green); }
.pill.orange { background: var(--orange-soft); color: var(--orange); }
.pill.red { background: var(--red-soft); color: var(--red); }
.pill.blue { background: var(--accent-soft); color: var(--accent); }
.pill.purple { background: var(--purple-soft); color: var(--purple); }
```

### Badge

```css
.badge {
  font-size: 11px; font-weight: 700; padding: 1px 6px;
  background: var(--surface2); color: var(--text2);
}
.badge.green { background: var(--green-soft); color: var(--green); }
.badge.orange { background: var(--orange-soft); color: var(--orange); }
.badge.blue { background: var(--accent-soft); color: var(--accent); }
```

### Stat tile

```css
.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 16px; }
.stat {
  background: var(--surface); border: 1px solid var(--border); padding: 12px 16px;
}
.stat-value { font-size: 28px; font-weight: 700; line-height: 1.1; }
.stat-label { font-size: 12px; color: var(--text2); margin-top: 4px; }
```

### Heat indicator

For cross-tab density, use background opacity to signal coverage depth:
- 1 lens: `rgba(94,159,232,0.05)`
- 2 lenses: `rgba(94,159,232,0.12)`
- 3 lenses: `rgba(94,159,232,0.20)`
- 4 lenses: `rgba(94,159,232,0.30)`

### Cost:benefit bar

Show as a two-bar visualization:

```css
.cb-bar { display: flex; gap: 4px; align-items: center; height: 20px; }
.cb-cost { background: var(--red-soft); border: 1px solid var(--red); height: 100%; }
.cb-benefit { background: var(--green-soft); border: 1px solid var(--green); height: 100%; }
.cb-label { font-size: 11px; color: var(--text2); min-width: 40px; }
```

## Mermaid diagrams

Load mermaid from CDN and initialize with dark theme and elk layout:

```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: '#1a1a1a',
      primaryColor: '#2a3a5e',
      primaryTextColor: '#e8e8e8',
      primaryBorderColor: '#5E9FE8',
      lineColor: '#5E9FE8',
      secondaryColor: '#2a2a2a',
      tertiaryColor: '#222222',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '13px'
    },
    flowchart: {
      defaultRenderer: 'elk',
      htmlLabels: true,
      padding: 12,
      nodeSpacing: 30,
      rankSpacing: 50
    }
  });
</script>
```

Each diagram lives in a wrapper:

```html
<div class="diagram-wrap">
  <pre class="mermaid">
    %%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%
    graph TD
      A[Root Pattern] --> B[Component 1]
      A --> C[Component 2]
  </pre>
</div>
```

```css
.diagram-wrap {
  padding: 16px; background: var(--surface2);
  border: 1px solid var(--border); margin: 12px 0; overflow-x: auto;
}
```

Choose diagram types that communicate the solution clearly:
- **Flowcharts** — solution architecture, decision trees, data flow
- **Sequence diagrams** — workflow changes, interaction patterns
- **Block diagrams** — system boundaries, component ownership
- **Mindmaps** — feedback grouping overview (use sparingly)

Keep diagrams focused: 5-15 nodes per diagram. Split complex solutions into multiple diagrams rather than one dense graph.

Mermaid syntax tips for clean rendering:
- Wrap node labels in square brackets for boxes: `A[Label text]`
- Use quotes for labels with special characters: `A["Label with (parens)"]`
- Avoid colons in labels unless quoted
- Keep node IDs short (A, B, C or meaningful abbreviations)

## Layout

```css
.container { max-width: 1200px; margin: 0 auto; padding: 24px; }
```

The document flows vertically through analysis sections. Each section is a panel. The executive summary and stats row sit above the panels.

Header:
```css
header {
  padding: 24px; border-bottom: 1px solid var(--border); margin-bottom: 16px;
}
header h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
header .subtitle { font-size: 14px; color: var(--text2); margin-top: 4px; }
```

Footer:
```css
footer {
  padding: 12px 24px; border-top: 1px solid var(--border);
  font-size: 12px; color: var(--text3); margin-top: 24px;
}
```

## Rich text in analysis content

Format analysis text with HTML:
- `<strong>` for key terms and pattern names
- `<code>` for technical names, system components, and IDs
- `<ul>` / `<ol>` for lists
- `<blockquote>` for quoted feedback

```css
blockquote {
  border-left: 3px solid var(--accent); padding: 8px 16px;
  margin: 8px 0; color: var(--text2); font-style: italic;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px; background: var(--surface3); padding: 1px 4px;
}
```

## Self-contained requirement

The HTML file must work when opened locally with no server:
- All CSS in a `<style>` tag in `<head>`
- Mermaid loaded from CDN — the only external dependency
- No other external resources (no fonts, no images, no other scripts)
- All data and analysis embedded in the document
