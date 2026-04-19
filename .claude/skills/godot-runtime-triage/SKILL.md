---
name: runtime-triage
description: Use when a Godot/.NET project has a build failure, editor error, runtime exception, crash, scene load failure, startup failure, or unexplained bad behavior and the agent must classify the symptom, identify the most likely layer, request only the minimum missing evidence, and return a focused triage report before broader investigation structure is justified.
---

# Runtime Triage

Use this skill when a Godot 4.6 + .NET/C# project is broken, noisy, crashing, or behaving incorrectly and the failure layer is not yet clear.

This is the first-response skill for Godot/.NET troubleshooting. Its job is not to guess wildly or jump straight into edits. Its job is to turn messy symptoms into a grounded triage report with the smallest useful next step.

Prefer this skill when the task is still narrow and evidence-led, and the best next move is one focused diagnosis rather than a broader investigation worker.

## Purpose

This skill is used to:

- classify the problem into the correct layer
- determine the minimum necessary evidence
- rank the most likely causes
- propose the next investigation, fix, and verification order

## Use this skill when

Invoke this skill for problems such as:

- build failure
- editor error
- runtime exception
- crash
- scene load fail
- startup failure
- incorrect or unstable behavior with unclear root cause

### Trigger examples

- "Godot 4.6 C# build fails"
- "The scene crashes when I open it"
- "I get a null reference as soon as gameplay starts"
- "The editor throws a flood of errors when the project opens"
- "After the upgrade the project suddenly won't run"

## Do not use this skill when

Do not use this skill when:

- the failure layer and exact fix are already known
- the user wants feature implementation rather than diagnosis
- the task is a narrow refactor with no troubleshooting component
- the issue is purely product/design behavior with no technical symptom

## Pattern

- Primary pattern: **Generator**
- Secondary pattern: **Tool Wrapper**

Why this fit is better than the alternatives:

- the skill must produce a repeatable, structured triage report
- it also packages domain-specific classification rules for Godot/.NET troubleshooting
- a full Pipeline would add ceremony without adding enough value, because the ordered workflow can live directly in this file

## Problem layers covered

Every triage result must classify the issue into one primary layer, with one optional secondary layer if needed:

1. **build / compile**
2. **.NET project / SDK / restore**
3. **Godot editor configuration**
4. **scene / resource loading**
5. **runtime exception / logic bug**
6. **environment / version / tooling mismatch**

If multiple layers are involved, identify the first failing layer and call out downstream effects separately.

## Inputs

Collect or infer these inputs when available:

- symptom summary in one or two sentences
- exact error text, stack trace, console output, or crash signal
- when the problem happens: open project, build, run, load scene, enter gameplay, export, etc.
- what changed recently: version upgrade, package change, renamed file, moved scene, editor settings change, SDK change
- relevant environment details: Godot version, .NET SDK version, OS, IDE/editor, plugin/tooling versions
- minimal reproduction path
- relevant file or asset paths mentioned by the error

If inputs are incomplete, do not block on perfect context. Request only the minimum missing evidence needed to separate the top causes.

## Workflow

Follow this sequence every time.

### 1. Classify the symptom

State the primary symptom in plain language.

Examples:

- build fails before launching
- editor opens but emits assembly/configuration errors
- a scene crashes while opening
- the game starts and then throws a runtime exception
- behavior is wrong but there is no explicit crash

Do not merge different symptoms into one vague sentence. Separate the trigger event from the observed failure.

### 2. Extract the key error signals

Quote the highest-signal evidence exactly when available.

Prefer:

- exact compiler error codes
- exact .NET SDK / NuGet / MSBuild messages
- exact Godot loader/editor messages
- exception type + top stack frame
- resource or scene path mentioned in the failure

Do not paraphrase away the useful bits. One precise line beats ten lines of mush.

### 3. Determine the failing layer

Map the symptom to one of the six triage layers.

For the chosen layer, explain briefly:

- why it is the most probable first failing layer
- whether another layer is only a consequence

If unsure between two layers, say so explicitly and identify the decision point that will separate them.

### 4. List the 2–4 most likely causes

Rank likely causes from most to least probable.

Rules:

- list **2 to 4** causes only
- tie each cause to a clue already observed
- prefer concrete causes over generic guesses
- if confidence is low, say what evidence would raise or lower confidence

Bad:

- "something is misconfigured"

Better:

- "the project is using an SDK or target framework that the installed .NET toolchain cannot resolve, suggested by the restore/build message"

### 5. Identify missing evidence

Call out only the missing evidence that would change the ranking of likely causes.

Examples:

- full exception type and first stack frame
- the exact scene/resource path that fails to load
- `dotnet --info` output
- relevant `csproj` target framework or package reference block
- the editor output panel text shown immediately before the crash

Do not ask for entire repositories or giant logs unless the case truly demands it.

### 6. Recommend the minimum next probe

Propose the smallest next action that can distinguish between the leading causes.

Good next probes are:

- one command to run
- one log/output pane to capture
- one file block to inspect
- one reproduction step to retry under tighter observation
- one targeted config/version check

Do not jump straight to a broad rewrite or speculative multi-step fix.

### 7. Recommend fix and verification order

When enough evidence exists, propose the next sequence in this order:

1. confirm or eliminate the top cause
2. apply the smallest safe fix
3. verify the original symptom is gone
4. check for regressions in adjacent behavior

If evidence is still weak, keep this section short and frame it as a probe plan rather than a fix plan.

## Output contract

Return the result using `assets/runtime-triage-report.md` in this section order:

- `Symptom summary`
- `Probable layer`
- `High-confidence clues`
- `Likely causes`
- `Missing evidence`
- `Recommended next probe`
- `Verification after fix`
- `Regression guard`

Output rules:

- keep it evidence-led, not theory-led
- rank causes by probability
- keep likely causes to 2–4 items unless the case is truly ambiguous
- separate known facts from inferred causes
- if evidence is missing, say exactly what is missing and why it matters
- keep the section order stable so the triage report is easy to scan and compare across cases

## Investigation heuristics

- Prefer the **first failing signal** over later cascade errors.
- Separate **symptom**, **layer**, and **cause**. They are not the same thing.
- If a recent change exists, treat it as a strong clue, not automatic proof.
- Scene/resource errors often surface during runtime, but their first real layer may be loading rather than logic.
- Editor errors after opening a project often come from configuration, restore, or version mismatch rather than scene logic.
- A crash with no obvious stack trace is still triageable if you can identify the trigger point and last emitted log line.

## Companion files

- `references/triage-categories.md` — category definitions, symptom mapping, and common signal-to-direction hints
- `assets/runtime-triage-report.md` — reusable report template for final triage output

## Validation

A good triage result should satisfy all of the following:

- one primary failing layer is identified
- the key error signals are quoted or explicitly marked as missing
- 2–4 likely causes are ranked
- missing evidence is minimal and decision-relevant
- the next probe is actionable and small
- verification covers both symptom resolution and nearby regressions

## Common pitfalls

- jumping straight to a fix before identifying the failing layer
- asking for too much evidence too early
- mixing cascade errors with the primary fault
- treating version changes as the only cause without checking the actual signal
- returning a generic diagnosis with no next probe

## Completion rule

This skill is complete when the agent has:

- classified the issue into the most probable layer
- extracted the highest-signal evidence available
- ranked the most likely causes
- identified the minimum missing evidence
- recommended the smallest next probe
- described how to verify the fix and guard against regression
