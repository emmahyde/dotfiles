# Abstraction Integrity Review Report

## Change context

- Change or feature under review:
- Why the change is being made:
- Abstraction or owner under pressure:
- Main concern for this review:

## Touched seam

- Main scenes, scripts, services, or coordinators involved:
- Caller or neighboring layer surface:
- New flags, modes, adapters, or compatibility switches introduced:
- Internal seam, public seam, or both:

## Decay risks

- Flag creep:
- Boundary leakage:
- Responsibility drift:
- Future change-cost warning:

## Compatibility posture

- Compatibility or transitional support present?:
- Is it edge-contained or center-contaminating?:
- Main legacy-path risk:
- What should not spread further:

## Containment options

1. **Option 1**
   - Change:
   - What decay it contains:
   - Trade-off:
2. **Option 2**
   - Change:
   - What decay it contains:
   - Trade-off:
3. **Optional Option 3**
   - Change:
   - What decay it contains:
   - Trade-off:

## Verification impact

- Hardest seam to reason about now:
- Focused check that would raise confidence most:
- Regression seam most worth protecting:
- What becomes easier if the recommended option is taken:

## Integrity verdict

- Verdict: `Healthy` / `Watch` / `Drifting`
- Why this verdict fits:
- What would improve confidence or contain the decay:

## Recommended next step

- Best next move now:
- Why this step is preferred first:
- What evidence would show the abstraction is back under control:
