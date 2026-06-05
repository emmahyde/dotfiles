---
name: d2
description: D2 is a declarative diagram scripting language that turns text into production-quality diagrams. Use when the user wants to create, edit, or debug architecture diagrams, ERDs, sequence diagrams, grid layouts, or any text-to-diagram workflow.
doc_version: 0.7.1
---

# D2 Skill

D2 (Declarative Diagramming) is a modern diagram scripting language that turns text into beautiful, production-ready diagrams. You describe what you want diagrammed and D2 generates the image. It supports multiple export formats (SVG, PNG, PDF, PPTX, GIF, ASCII), multiple layout engines, themes, sketch mode, and powerful composition features.

- **Source:** https://d2lang.com
- **GitHub:** https://github.com/terrastruct/d2
- **Playground:** https://play.d2lang.com

## When to Use This Skill

This skill should be triggered when:
- The user asks to **create a diagram** of any kind (architecture, ERD, sequence, flowchart, grid)
- The user wants to **write D2 code** or asks about D2 syntax
- The user wants to **generate diagrams from text** or mentions "text-to-diagram"
- The user asks about **diagram layout engines** (dagre, ELK, TALA)
- The user wants to create **SQL table / ERD diagrams**
- The user wants to create **sequence diagrams**
- The user wants to create **grid diagrams** or pixel art
- The user wants **animated diagrams**, multi-board compositions, or PowerPoint exports
- The user asks about **D2 themes, styling, sketch mode**, or dark-mode responsive diagrams
- The user is **debugging D2 code** or troubleshooting rendering issues
- The user asks about **C4 model diagrams** or model-view patterns
- The user wants diagrams embedded in **documentation, code comments (ASCII), or wikis**

## Key Concepts

### Shapes and Connections
D2's core primitives. Shapes are declared by naming them; connections use arrows (`->`, `<-`, `<->`, `--`).

### Containers
Shapes can be nested to create logical groupings. Use curly braces `{}` for nested syntax.

### Labels, Icons, and Styles
Every shape can have custom labels, icons (via URL), and granular style properties (fill, stroke, opacity, font, shadow, border-radius, etc.).

### Layout Engines
- **Dagre** (default) -- hierarchical, open-source, widely used
- **ELK** -- mature hierarchical engine from academic research, supports exact SQL column routing
- **TALA** -- proprietary engine by Terrastruct, most capable (per-container direction, `near` positioning, `top`/`left` values)

### Composition (Multi-board Diagrams)
D2 supports multi-board diagrams via three keywords:
- **`layers`** -- each layer starts blank (different levels of abstraction)
- **`scenarios`** -- inherit from parent, show alternate views
- **`steps`** -- inherit from previous step, show sequences

### Imports and Modularization
Split diagrams across files using `@filename` (regular import) or `...@filename` (spread import). Enables model-view patterns and reusable component libraries.

### Variables and Globs
- **`vars`** -- define variables, reference with `${}` syntax
- **Globs** (`*`, `**`, `***`) -- powerful bulk targeting for styles, connections, and filters

### Classes
Reusable style bundles applied to shapes/connections. Support multiple classes via arrays.

### Themes
Built-in light and dark themes. Dark-mode responsive diagrams adapt to system preferences. Custom theme overrides available.

## Quick Reference

### 1. Hello World -- Basic Shapes and Connections

```d2
x -> y: hello world
```

Declares two shapes `x` and `y` connected with a labeled arrow.

### 2. Shapes with Types

```d2
Cloud: My Cloud Service {
  shape: cloud
}
Database: Users DB {
  shape: cylinder
}
Cloud -> Database: reads from
```

Available shapes include: `rectangle` (default), `oval`, `circle`, `cylinder`, `diamond`, `hexagon`, `cloud`, `queue`, `parallelogram`, `page`, `package`, `class`, `sql_table`, `sequence_diagram`, `c4-person`, `text`, `image`, and more.

### 3. Containers (Nested Shapes)

```d2
server: Backend {
  api: API Layer
  db: Database {
    shape: cylinder
  }
  api -> db: queries
}
client: Frontend {
  app: React App
}
client.app -> server.api: HTTP requests
```

### 4. SQL Tables (ERD Diagrams)

```d2
users: {
  shape: sql_table
  id: int {constraint: primary_key}
  name: varchar
  email: varchar {constraint: unique}
  org_id: int {constraint: foreign_key}
}

orgs: {
  shape: sql_table
  id: int {constraint: primary_key}
  name: varchar
}

users.org_id -> orgs.id
```

Constraints are auto-shortened: `primary_key` -> PK, `foreign_key` -> FK, `unique` -> UQ.

### 5. Sequence Diagrams

```d2
shape: sequence_diagram
alice -> bob: What's up?
bob -> alice: Not much
bob -> charlie: Want to grab lunch?
charlie -> bob: Sure!
```

Supports spans (activation boxes), groups (fragments), notes, and self-messages. Order of declarations determines visual order.

### 6. Grid Diagrams

```d2
grid: {
  grid-rows: 2
  grid-columns: 3

  A; B; C
  D; E; F
}
```

Control layout with `grid-rows`, `grid-columns`, `grid-gap`, `vertical-gap`, `horizontal-gap`. First keyword sets dominant fill direction.

### 7. Styling

```d2
x: Styled Shape {
  style: {
    fill: "#f4a261"
    stroke: "#264653"
    stroke-width: 3
    border-radius: 8
    shadow: true
    font-size: 18
    font-color: "#264653"
    opacity: 0.9
  }
}
```

Root-level styles: `style.fill` (background), `style.stroke` (border), `style.fill-pattern`.

### 8. Icons

```d2
aws: AWS {
  icon: https://icons.terrastruct.com/aws%2F_Group%20Icons%2FAWS-Cloud-alt_light-bg.svg
}
k8s: Kubernetes {
  icon: https://icons.terrastruct.com/azure%2F_Companies%2FKubernetes.svg
  shape: image
}
```

Use `shape: image` for standalone icon shapes. Free icons at https://icons.terrastruct.com.

### 9. Classes (Reusable Styles)

```d2
classes: {
  error: {
    style.fill: "#e76f51"
    style.font-color: white
  }
  success: {
    style.fill: "#2a9d8f"
    style.font-color: white
  }
}

failed: Deploy Failed {class: error}
passed: Tests Passed {class: success}
```

Multiple classes: `class: [error; highlight]`. Applied left-to-right.

### 10. Variables and Globs

```d2
vars: {
  primary: "#264653"
}

# Apply style to all shapes
*: {
  style.fill: ${primary}
}

# Connect all top-level shapes to each other
* -> *
```

- `*` targets all at current scope
- `**` targets recursively
- `***` targets globally (across layers and imports)
- Filters: `* { &shape: sql_table }` targets only SQL tables

### 11. Composition (Animated / Multi-board)

```d2
# Base diagram
x -> y

# Define a scenario (inherits base)
scenarios: {
  hot-fix: {
    x -> y: deploy hotfix
    y.style.fill: red
  }
}
```

Export with `--animate-interval=1200` for animated SVGs. Use `layers` for abstraction levels, `steps` for sequential flows.

### 12. Markdown and Code Labels

```d2
explanation: |md
  # Architecture Overview
  This system handles **user authentication**
  and routes requests to microservices.
|
```

Supports `md` (Markdown), `latex`/`tex`, and programming language syntax highlighting (e.g., `|go`, `|python`, `|ts`).

### 13. Themes and Sketch Mode

```bash
# Apply a theme
d2 --theme=200 input.d2 output.svg

# List available themes
d2 theme

# Sketch (hand-drawn) mode
d2 --sketch input.d2 output.svg

# Dark-mode responsive
d2 --dark-theme=200 input.d2 output.svg
```

### 14. CLI Essentials

```bash
# Basic compile
d2 input.d2 output.svg

# Watch mode (live reload in browser)
d2 --watch input.d2 output.svg

# Export formats
d2 input.d2 output.png
d2 input.d2 output.pdf
d2 input.d2 output.pptx
d2 input.d2 output.gif
d2 input.d2 output.txt   # ASCII art

# Layout engine
d2 --layout=elk input.d2 output.svg

# Autoformat
d2 fmt input.d2
```

### 15. Imports

```d2
# Regular import (wraps file content as child of `infra`)
infra: @infrastructure.d2

# Spread import (merges file content into current scope)
...@shared-styles.d2

# Partial import
team-lead: @org.managers.alice
```

Omit `.d2` extension (autoformatter removes it). Relative to file location, not working directory.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Reserved characters in labels | Wrap in single `'` or double `"` quotes |
| `err: failed to launch Chromium` | Install Playwright dependencies: `npx playwright install --with-deps chromium` |
| Connections look cluttered | Manually set `width` and `height` on highly-connected shapes for more routing space |
| SVG not interactive when embedded | Use `<object>` or `<iframe>` tags, not `<img>` (which strips interactivity) |
| Non-ASCII chars treated as syntax | Use ASCII versions of `:`, `;`, `.` etc. The full-width `：` is not the same as `:` |
| HTML in Markdown breaks SVG | Use semantic XHTML (`<br/>` not `<br>`) |
| Reserved keyword as key | Quote it: `"label": My Label` |

## Reference Files

This skill includes documentation scraped from the official D2 site in `references/`:

| File | Description | Contents |
|------|-------------|----------|
| **tour.md** | Complete language tour (62 pages) | Syntax, shapes, connections, containers, styles, composition, layouts, sequence diagrams, SQL tables, grid diagrams, globs, variables, imports, themes, CLI, API, FAQ |
| **blog.md** | Blog posts (11 pages) | Animated diagrams, hand-drawn sketch mode, dark-mode responsive, PowerPoint export, C4 model support, ASCII output |
| **releases.md** | Release notes (24 versions) | Feature history from 0.0.13 through 0.7.1 -- useful for understanding when features were added |
| **other.md** | Example gallery (2 pages) | Curated diagram examples split by layout engine |
| **index.md** | Documentation index | Category listing |

**Primary reference:** `tour.md` covers the vast majority of D2 features and is the most comprehensive source.

## Working with This Skill

### For Beginners
1. Read the Quick Reference examples above (1-5) to understand core syntax
2. Consult `references/tour.md` sections on Shapes, Connections, and Containers
3. Use the playground at https://play.d2lang.com to experiment

### For Intermediate Users
- **Styling:** Quick Reference examples 7-9, plus the Styles section of `tour.md`
- **Layout control:** Grid diagrams (example 6), positions (`near` keyword), layout engines
- **Sequence diagrams:** Example 5, plus detailed rules in `tour.md` Sequence Diagrams section
- **SQL/ERD:** Example 4, supports foreign key routing with ELK/TALA engines

### For Advanced Users
- **Composition:** Layers, Scenarios, Steps for multi-board animated diagrams (example 11)
- **Model-View pattern:** Define models once, create multiple views with `suspend`/globs
- **C4 diagrams:** Use `c4-person` shape, C4 themes, suspend/unsuspend with class filters -- see `references/blog.md` C4 section
- **Programmatic API:** `d2oracle` Go package for creating/editing diagrams programmatically
- **Imports:** Modularize large diagrams across files (example 15)
- **Globs with filters:** `* { &shape: sql_table }`, `** -> **`, `!&` inverse filters
- **Custom themes:** Override theme color codes via `vars.d2-config.theme-overrides`

### Design Principles (from official docs)
- **Readability over prototyping speed** -- D2 favors readable syntax over terse shortcuts
- **Warnings over errors** -- compiles whenever possible, warns for non-critical issues
- **Good defaults** -- zero-customization D2 should produce good diagrams
- **Focused on software documentation** -- not a general-purpose visualization tool
- **Design the system, not the diagram** -- content and styling are deliberately separated

## Resources

- **Official docs:** https://d2lang.com
- **Playground:** https://play.d2lang.com
- **GitHub:** https://github.com/terrastruct/d2
- **Icons:** https://icons.terrastruct.com
- **Comparisons:** https://text-to-diagram.com
- **VSCode extension:** https://github.com/terrastruct/d2-vscode
- **Vim plugin:** https://github.com/terrastruct/d2-vim
- **Obsidian plugin:** https://github.com/terrastruct/d2-obsidian
- **Discord:** Community support and discussion
- **D2 Studio:** Professional IDE at https://terrastruct.com (paid, free to evaluate)
