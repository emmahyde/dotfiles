# Attached Preview Comments Template
**Law 33: Hard-scope the agent with attached comments**

## Hard Scope Block

Copy this template and populate with actual comment entries from your annotation session. This block explicitly forbids scope creep by limiting changes to only the identified elements.

```
<attached-preview-comments>

**Hard scope:** Change ONLY the elements identified below by selector, position, or pod members. Do not modify anything outside this list.

| # | Element ID | Target Kind | File | Label | Position | Current Text | HTML Hint | Computed Style | Comment |
|---|------------|-------------|------|-------|----------|--------------|-----------|----------------|---------|
| 1 | `hero-title` | selector: `.hero h1` | index.html | Hero Title | line 45 | "Welcome to the future" | `<h1 class="hero">…</h1>` | `font-size: 48px; color: #000;` | Make the title more compelling and action-oriented. Current text feels generic. |
| 2 | `cta-button` | selector: `.hero .btn-primary` | index.html | CTA Button | line 52 | "Get Started" | `<button class="btn-primary">…</button>` | `background: #0066cc; padding: 12px 24px;` | Add icon to button, increase padding for touch targets (minimum 44px). Consider "Start Free Trial" instead. |
| 3 | `feature-cards` | pod: `[.feature-card-1, .feature-card-2, .feature-card-3]` | index.html | Feature Cards (all three) | lines 60–78 | Card titles and descriptions | `<div class="feature-card">…</div>` | `display: grid; grid-template-columns: repeat(3, 1fr);` | Reorder cards by user benefit, not feature complexity. Test mobile layout—currently breaks at 768px. |

</attached-preview-comments>
```

## Fields Explained

- **#**: Numbered pin on the wireframe or screenshot (①, ②, ③, etc.)
- **Element ID**: Stable identifier for this element in your codebase
- **Target Kind**: How to find the element: `selector: '...'` (CSS), `position: line N` (file location), or `pod: [...]` (multi-element group)
- **File**: Source file path relative to project root
- **Label**: Human-readable label for the element (shown on pin)
- **Position**: Line number(s) in source file for quick lookup
- **Current Text**: Exact text as it appears now (for verification)
- **HTML Hint**: Minimal snippet showing element structure
- **Computed Style**: Key visual properties (font-size, color, spacing, etc.)
- **Comment**: The annotation—what to change and why

## How to Use

1. **Capture annotations** in your review surface (Plannotator, Open Design, or custom overlay)
2. **Serialize each comment** into one table row with the fields above
3. **Strip visual marks** from screenshots; relay them as text instructions in the Comment column
4. **Include selector or position** so the agent can locate the element:
   - Prefer CSS selectors for styling changes
   - Use line numbers for content changes
   - List all members for multi-element selections ("pods")
5. **Send the block** to the agent by appending it to your message before invoking revision

## Agent Directive

When you receive this block, the agent reads it as:

> "You must change ONLY elements #1–N listed below. Each row is a separate, scoped annotation. Do not modify elements outside this list. Do not expand scope. For each comment, verify the current text matches the table before applying the change."

This pattern prevents agents from over-interpreting visual feedback and keeps revisions focused.
