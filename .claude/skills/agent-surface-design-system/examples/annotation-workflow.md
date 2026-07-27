# Example: Annotation Workflow

An end-to-end workflow for capturing, staging, and dispatching design feedback that flows back to the agent as hard-scoped revision instructions.

## Workflow Steps

### 1. Preview Interaction and Snapshot

User clicks an element in a sandboxed preview iframe. The system captures a `PreviewCommentSnapshot`:

```json
{
  "filePath": "src/components/Button.tsx",
  "elementId": "btn-primary-lg",
  "selector": ".btn.btn-primary.btn-lg",
  "position": { "x": 120, "y": 340 },
  "label": "Primary Button (Large)",
  "currentText": "Save Changes",
  "htmlHint": "<button class=\"btn btn-primary btn-lg\">Save Changes</button>",
  "computedStyle": {
    "backgroundColor": "#0066cc",
    "fontSize": "16px",
    "padding": "12px 24px"
  }
}
```

### 2. Visual Annotation (Draw/Box Tools)

User enters draw mode (Law 17: keyboard-first — press `D` for draw, `B` for box). The annotation toolbar is portaled outside the scrollable preview area (Law 37) so it remains visible even in clipped frames.

User can:
- **Box select:** highlight an element with a rectangular outline.
- **Pen stroke:** sketch freehand marks on the preview.

The system composites the visual mark onto a screenshot and classifies it as `click`, `stroke`, or `click+stroke` (Law 32).

### 3. Comment Composition

User types a note attached to the visual mark:

```
"Button needs more padding and darker background color.
Current look is too subtle against light backgrounds."
```

The mark + text pair is now a complete annotation object:

```json
{
  "kind": "stroke",
  "bounds": { "x": 100, "y": 330, "width": 150, "height": 50 },
  "markSnapshot": "data:image/png;base64,...",
  "target": {
    "filePath": "src/components/Button.tsx",
    "elementId": "btn-primary-lg",
    "selector": ".btn.btn-primary.btn-lg",
    "htmlHint": "<button class=\"btn btn-primary btn-lg\">Save Changes</button>"
  },
  "note": "Button needs more padding and darker background color..."
}
```

### 4. Staging Actions (Draft / Queue / Send)

The draw toolbar exposes three distinct actions (Law 34):

- **Draft:** Add annotation to the input composer without sending. User builds a message incrementally.
- **Queue:** Stage the annotation for the next turn (when current agent job finishes).
- **Send:** Dispatch feedback immediately (only if no agent job is running).

User chooses "Queue" to batch multiple annotations before the next agent revision.

### 5. Hard-Scope Block

When user clicks "Send feedback," the surface renders an `<attached-preview-comments>` block with hard-scope instructions (Law 33):

```
<attached-preview-comments>
Hard scope: change ONLY the elements identified below by selector / position / pod members.

### Annotation 1: Button Styling
- File: src/components/Button.tsx
- Selector: .btn.btn-primary.btn-lg
- Current HTML: <button class="btn btn-primary btn-lg">Save Changes</button>
- Current Style: backgroundColor #0066cc, padding 12px 24px, fontSize 16px
- Feedback: Button needs more padding and darker background color. Current look is too subtle against light backgrounds.
- User Note: Move from light blue to dark navy, increase padding to 16px 32px.

### Annotation 2: Button Hover State
- File: src/components/Button.tsx
- Selector: .btn.btn-primary:hover
- Current Style: opacity 0.8
- Feedback: Hover state should shift color, not just opacity. Add a slight downward translate for depth.
</attached-preview-comments>
```

### 6. Agent Revision

The agent receives the hard-scope block and reads:
- Exact selectors it must modify
- Current computed styles and HTML
- User-provided feedback and notes
- Explicit instruction: "change ONLY these elements"

Agent revises only the scoped elements and returns the updated artifact. (Law 33)

### 7. Distillation into Memory

After the agent returns a revision, the surface runs a memory distiller (Law 35) that converts annotations into durable memory entries:

```yaml
# MEMORY.md entry
## Rule: Button styles need dark navy + generous padding
- Source: Preview annotation (Session 2026-06-26T17:45Z)
- Pattern: All primary action buttons should use dark navy (#003366) with 16px 32px padding
- Applied to: .btn.btn-primary in src/components/Button.tsx
- Rationale: Light blue is too subtle; dark navy provides better contrast and visual weight
```

These entries persist in the project's memory store and influence future agent decisions. (Law 35)

## Layout Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Design Generation Surface                               │
├──────────────────────────┬───────────────────────────── │
│ Agent chat / transcript  │ Sandboxed preview iframe    │
│                          │ + Draw overlay              │
│                          │ (D=draw, B=box, Esc=exit) │
├──────────────────────────┼───────────────────────────── │
│                          │ ┌─ Toolbar (portaled out)   │
│                          │ │  [Draft] [Queue] [Send]   │
│                          │ └─────────────────────────── │
├──────────────────────────┴───────────────────────────── │
│ 💬 Staged Annotations (2 pending)                       │
│ • Button hover state — "add translate on hover"        │
│ • Settings icon — "make icon 24px instead of 16px"     │
└─────────────────────────────────────────────────────────┘
```

## Key Design Principles

- **Annotations capture DOM context** (Law 31): Every comment includes filePath, selector, currentText, htmlHint, and computedStyle so the agent can re-find the element.
- **Visual marks are first-class** (Law 32): Drawing a box or stroke is a valid comment; the system composites it onto a screenshot the agent sees.
- **Hard scope prevents scope creep** (Law 33): The agent receives explicit instructions to change ONLY the annotated elements.
- **Three-action staging** (Law 34): Draft, Queue, and Send are distinct; user builds feedback without forcing dispatch.
- **Memory distillation** (Law 35): Review feedback outlives the chat turn; rules and patterns are stored and influence future agent work.
- **Toolbar stays visible** (Law 37): The annotation toolbar is portaled outside scroll areas so it never scrolls away or gets clipped in scaled previews.
