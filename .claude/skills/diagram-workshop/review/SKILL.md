---
name: diagram-workshop-review
description: Use when the user shares an annotated diagram image — arrows, circles, rectangles, or text notes drawn on a rendered visualization — and wants code changes based on the markup. Triggers on "here are my annotations", "fix what I marked", "see the red circle", or when a diagram PNG with hand-drawn markup is shown.
---

# Diagram Workshop — Review

The user has annotated a rendered diagram using `annotate.js` and shared the result. Your job is to read the visual markup as instructions, confirm your interpretation, and implement the changes.

## Reading Annotation Types

Each tool in the overlay carries a conventional meaning. Read in this order: text notes first (explicit instructions), then arrows (directional changes), then shapes (area callouts).

| Annotation | Typical intent |
|---|---|
| **Text note** (T) | Explicit instruction — highest priority, follow literally |
| **Arrow** (→) | Directional: "move this here", "increase/decrease spacing", "connect these", "shift emphasis this way" |
| **Circle / ellipse** | "This area needs attention" — often paired with a text note explaining what |
| **Rectangle** | "Fix this region" — reposition a cluster, restyle a group, adjust a bounding area |
| **Freehand pen** | Emphasis or scribble-out: circling = "look here"; scribbling over = "remove/replace this" |
| **Multiple converging arrows** | "Merge these", "bring together", "reduce distance" |
| **Arrow pointing away** | "Move this further away", "separate these", "reduce coupling" |

## Workflow

**Step 1 — Describe what you see.**
Before proposing any changes, describe the annotations aloud: where they are, what tool was used, what they seem to be pointing at. This confirms you've read the image correctly and catches misreads before implementing.

Example: "I see a red arrow from the central cluster pointing toward the lower right, a circled node labeled 'API Gateway' with a text note saying 'too small', and freehand scribble over the leftmost edge."

**Step 2 — Interpret intent.**
Translate each annotation into a specific proposed change in the diagram code:

- Arrow toward lower right from cluster → shift cluster's y-center or increase `forceY` strength toward bottom
- Circle + "too small" on a node → increase node radius or font size for that node
- Scribble over an edge → remove that link from the data array

**Step 3 — Confirm if ambiguous.**
If an annotation could mean two different things, ask before implementing. Don't guess silently.

**Step 4 — Implement and re-render.**
Make the targeted changes in the diagram source. Keep all other code unchanged. Re-render so the user can see the result and annotate again if needed.

## Ambiguity Signals

Ask for clarification when:
- An arrow could mean "move" or "add a connection"
- A circle appears without any accompanying text
- Freehand strokes overlap multiple elements
- The image crop is tight and reference points are unclear

## Closing the Loop

After implementing, invite the next round: "Here's the updated diagram — add `annotate.js` again and mark anything else you'd like to adjust."
