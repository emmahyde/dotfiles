---
name: unwrap-markdown
description: Remove hard line wraps from Markdown files — join paragraph lines that were broken only to fit a max line length back into one line per paragraph. Use when asked to unwrap, reflow, dewrap, or "take the hard wraps out" of one or more .md files, a list of files, or a folder of Markdown.
---

# Unwrap Markdown

Strips mid-paragraph hard wraps (line breaks added only to satisfy a maximum
line length) so text reflows to the reader's width. Preserves everything that a
break is meaningful in: code blocks, tables, headings, lists' structure,
horizontal rules, HTML blocks, link reference definitions, YAML front matter,
blank lines, and intentional hard breaks (line ending in two spaces or `\`).

Paragraphs, list-item bodies, and blockquote text are joined; each gets one
logical line. The script is idempotent — running it again changes nothing.

## Usage

`scripts/unwrap.py` takes any mix of files and directories. Directories recurse
over Markdown files (`.md .markdown .mdown .mkd .mdx .mdc`). Edits in place by
default.

```bash
python3 scripts/unwrap.py FILE.md                 # single file, in place
python3 scripts/unwrap.py a.md b.md docs/          # files + a folder
python3 scripts/unwrap.py --dry-run docs/          # list what would change
python3 scripts/unwrap.py --stdout FILE.md         # preview to stdout, no write
```

Use the absolute path to the script (`.../skills/unwrap-markdown/scripts/unwrap.py`)
when invoking it from another directory. Prefer `--dry-run` first when the user
points it at a whole tree, then run for real.
