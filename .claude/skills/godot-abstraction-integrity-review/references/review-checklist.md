# Abstraction Integrity Review Checklist

Use this checklist when reviewing whether a Godot/.NET abstraction is staying healthy while a feature is being implemented, a flow is being extended, or touched code is being refactored.

The goal is not to ban complexity. The goal is to detect when the abstraction is absorbing change in a way that will make the next change less honest, less local, and more expensive.

## 1. Change pressure and seam clarity

Check that you can answer all of these clearly:

- What new behavior, flow, or case is being added?
- Which abstraction is under pressure from that change?
- What was that abstraction supposed to own before this change?
- Is the seam internal, public, or both?
- Which callers or neighboring layers now depend on the change?

Warning signs:

- the review cannot name the stressed abstraction in one sentence
- the change seems small, but many callers or layers now care about it
- the seam being stretched is only implied, not explicit
- no one can say what this owner is supposed to stop owning

## 2. Flag creep and mode-surface growth

Review whether conditional growth is still coherent.

Check:

- booleans, enums, optional parameters, or branching that changed the abstraction surface
- whether new cases are orthogonal or actually represent different responsibilities
- whether the branching burden is local and understandable or spreading outward
- whether the next case would likely add yet another flag or mode

Warning signs:

- multiple flags combine into unstable behavior combinations
- one method or scene now behaves like several policies hidden behind conditions
- callers must know which combination of switches is "safe"
- the abstraction keeps one name but now behaves like several roles

## 3. Boundary leakage

Review whether the change is crossing seams inappropriately.

Check:

- UI learning gameplay or persistence rules it should not own
- gameplay or service code learning scene, rendering, or editor setup details it should not care about
- scenes, autoloads, or managers becoming universal meeting points for unrelated concerns
- internals leaking outward through widened APIs, signal semantics, or config assumptions

Warning signs:

- distant layers now need to understand local branching detail
- temporary cross-layer reads or writes are presented as harmless convenience
- new code depends on scene-tree knowledge or caller knowledge that used to be hidden
- the abstraction is only preserved by naming, not by boundaries

## 4. Compatibility creep

Review whether compatibility support is contained.

Check:

- adapters, shims, legacy branches, or migration paths added during the change
- whether compatibility code sits at the edge or in the middle of the abstraction
- whether new callers pay complexity tax for older paths
- whether transitional handling is now changing the main contract shape

Warning signs:

- the core abstraction must speak both old and new semantics at once
- compatibility code is scattered across several owners instead of bounded
- old-path support keeps changing current method signatures or signal surfaces
- no one knows when or where the compatibility branch should end

## 5. Responsibility drift

Review whether the touched owner is gradually becoming the place where every exception lands.

Check:

- which owner now decides policy
- which owner now coordinates flow
- which owner now stores or translates state
- whether those jobs still belong together
- whether the touched owner is accumulating responsibilities faster than neighboring owners are shedding them

Warning signs:

- one class, scene, or coordinator is becoming the default answer to every new edge case
- the refactor moved code but not real ownership
- the abstraction appears cleaner locally but the surrounding system is murkier
- future edits are becoming less obvious, not more obvious

## 6. Containment options

Good containment options are:

- small enough to execute
- tied to the actual decay vector
- explicit about what boundary they restore
- likely to reduce future change cost without exploding abstraction count

Bad containment options are:

- rewrite the subsystem with no bounded seam
- add more layers without naming what pressure they absorb
- leave the decay in place and promise future cleanup with no trigger
- split responsibilities so finely that configuration or orchestration cost becomes worse than the original issue

## 7. Verification discipline

Review whether the safer direction can be proven.

Check:

- what seam is most likely to break next
- what focused test, smoke path, or reasoning check would validate the containment move
- whether the current abstraction shape can still be understood locally
- whether one more nearby requirement would be cheaper or more expensive after the recommended move

Warning signs:

- the preferred containment move sounds cleaner but has no concrete proof path
- no one can identify the highest-risk seam after the change
- the abstraction is already hard to reason about, but verification remains vague

## 8. Integrity verdict discipline

Use a verdict that matches the observed pressure.

Suggested verdicts:

- **Healthy** — the abstraction is absorbing the change without meaningful decay
- **Watch** — the abstraction is still viable, but one decay vector is emerging and should be contained soon
- **Drifting** — flag creep, boundary leakage, compatibility creep, or responsibility drift is already harming the seam and needs intervention

Do not inflate concern just because the change touched several files. Judge the seam, not the file count.
