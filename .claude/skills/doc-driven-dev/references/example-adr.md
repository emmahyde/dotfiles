# Worked example — a real ADR

This is an actual ADR from the project this process was extracted from (a privacy-respecting fork
of an AGPL terminal). It's here to show the *bar*, not to be copied literally. Note three things:

1. **Technical context is cited, not asserted** — every claim points at a `file:line` or a map
   section, so a reader can verify it. This is what separates a decision record from an opinion.
2. **Considered options are real** — there were genuine alternatives, and the Decision explains
   *why* this one won against them, not just what was chosen.
3. **Consequences are honest** — it names the permanent cost (can't relicense) plainly, not just
   the upside. An ADR that only lists positives isn't recording a trade-off.

---

# ADR-0001: Licensing posture — fork-and-strip under AGPL-3.0

- **Status:** Accepted
- **Date:** 2026-06-08
- **Deciders:** project author

## Context

The upstream client is open source under AGPL-3.0 (except two UI crates, which are MIT). We want
a local-first derivative with all analytics / auth / sync / network removed except user-configured
LLM + MCP traffic. Two routes can produce it: modify the source directly (fork), or reimplement
from a behavioral spec without copying source (clean-room). Motivation is privacy + learning,
explicitly *not* commercialization or relicensing.

## Technical context

Grounded in the source investigation (see `architecture-map.md`):

- The licensing split is confirmed in-repo (`LICENSE-AGPL` + `LICENSE-MIT`; only the two UI crates
  are MIT). The terminal, AI, and persistence crates are AGPL.
- The removable cluster is **seam-isolated**: of ~72 workspace crates, ~20 carry the
  auth/sync/telemetry/network surface, and nearly every init hook is centralized in one function
  (`app/src/lib.rs:initialize_app`); all network funnels through one provider. A fork cuts at these
  points rather than untangling pervasive coupling.
- **The clean-room wall is already breached for us:** producing the architecture maps required
  deep-reading the AGPL source, so we cannot serve as a clean-room implementer.

## Decision drivers

- Time to a working tool (weeks vs. months/years).
- Legal defensibility and risk.
- Ability to track upstream improvements.
- Whether the result must ever be closed-source (currently: no).

## Considered options

1. **Fork-and-strip (stay AGPL-3.0)** — modify the source, cut subsystems at known seams.
2. **Clean-room reimplementation (escape AGPL)** — new code from a sanitized behavioral spec.
3. **Hybrid** — reuse the MIT UI crates + clean-room only the AGPL parts.

## Decision

We will **fork-and-strip under AGPL-3.0 and publish source.** AGPL explicitly permits modification
+ redistribution, the removable cluster is cleanly seam-isolated (a fork is weeks, not months), and
a defensible clean-room is impossible for us regardless because we've already read the source.
Clean-room's only unique benefit — escaping AGPL to relicense/close — is out of scope.

## Consequences

- **Positive:** fast path to a working tool; zero derivation risk (AGPL-sanctioned); can rebase on
  upstream to inherit improvements; deep learning from a real codebase.
- **Negative / cost:** the result is **permanently AGPL** — it cannot be relicensed or closed; on
  distribution we must publish corresponding source and preserve notices.
- **Neutral / follow-ups:** drop upstream trademarks/branding; revisit only if a closed-source
  product is ever desired.

## References

- `architecture-map.md` — core / licensing / seam findings.
- Source: `LICENSE-AGPL`, `LICENSE-MIT`, `app/src/lib.rs` (`initialize_app`).
- GNU AGPL-3.0 §5–§6 (conveying source on distribution), §13 (remote network interaction).
- Related: ADR-0002 (egress invariant), ADR-0003 (transport).
```
