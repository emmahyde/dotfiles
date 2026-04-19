---
description: "Adversarial peer review of any document — finds unsupported claims, logical gaps, and overconfident assertions"
argument-hint: "<file-path>"
allowed-tools: ["Read", "Write", "Glob", "Grep"]
---

# Peer Review: "$ARGUMENTS"

Run an adversarial peer review on the specified document.

## Workflow

1. **Read the document** at the specified path. If no path given, ask which file to review.

2. **Spawn a `feynman:reviewer` agent:**
   ```
   Review the document at [file path].
   Save review to outputs/[filename]-review.md.
   ```

3. **Present the review** to the user with a summary:
   - Verdict (ACCEPT / REVISE / REJECT)
   - Count of FATAL / MAJOR / MINOR issues
   - Top issues highlighted

4. **If the user wants fixes applied:**
   - Address FATAL issues first
   - Then MAJOR issues
   - Re-run the reviewer on the updated document if significant changes were made
