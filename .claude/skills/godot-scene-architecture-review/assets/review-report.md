# Scene Architecture Review Report

## Context

- Target scene or system:
- Intended role:
- Review scope:
- Main architectural question:

## Current structure

- Key scenes and child-scene boundaries:
- Important nodes and attached scripts:
- Main communication paths (signals, direct references, autoloads):
- Where orchestration currently lives:

## Responsibility issues

- Scene split reasonableness:
- Node hierarchy responsibility load:
- Script ownership clarity:
- Reusable scene boundary clarity:

## Coupling risks

- Signal health:
- Direct reference or node-path coupling:
- Autoload / singleton fit vs overuse:
- UI and gameplay coupling:
- Over-centralization or god-object risk:

## Refactor options

1. **Option 1**
   - Change:
   - Why it helps:
   - Trade-off:
2. **Option 2**
   - Change:
   - Why it helps:
   - Trade-off:
3. **Optional Option 3**
   - Change:
   - Why it helps:
   - Trade-off:

## Verification impact

- Testability impact:
- Maintainability / change-cost impact:
- What should be re-verified after refactor:
- Highest-risk regression seam:

## Recommended next step

- Best next move now:
- Why this step is preferred first:
- What evidence would confirm it worked:
