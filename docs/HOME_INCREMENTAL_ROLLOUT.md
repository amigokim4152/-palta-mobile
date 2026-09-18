# Home Incremental Rollout

Status: active execution plan for `integration/home-visual-baseline-v1`.

## Operating rule

A Home step is not considered complete when code exists. It is complete only when all three gates are satisfied:

1. repository checks pass,
2. the iOS Simulator opens without a compile/runtime error,
3. the expected Home state is visibly confirmed on screen.

No later step may be integrated before the current step passes all three gates.

## Stable starting point

Base: `integration/simulator-runtime-fix-v1` at `22946834c66d82310ebf753294b1d1c0961d9a54`.

Visual baseline branch: `integration/home-visual-baseline-v1`.

The visual baseline deliberately does not import `src/home/*`, call `/v1/home`, fetch weather, fetch municipality data, fetch news, or read transit ETA. It exists only to verify the design system and screen composition in the real Expo app.

## Rollout gates

### Gate 1 — Static visual baseline

Visible structure:

- Palta header and tagline
- greeting and locality
- explicit development/example-data badge
- Glance
- AHORA
- EN CURSO
- PRÓXIMO
- PARA HOY
- quiet end state

Acceptance:

- no red screen
- no unresolved module error
- Home scrolls normally
- Barrio still opens
- map/runtime recovery remains unchanged
- typography, spacing and hierarchy can be reviewed from a screenshot

### Gate 2 — Mock Home payload

Replace static content with one local mock contract only. No external network sources.

Acceptance:

- the same visual hierarchy remains
- mock data can disappear without breaking layout
- no fake action is interactive
- loading, empty and error states are visible and testable

### Gate 3 — Weather

Connect one weather source only.

Acceptance:

- ordinary weather stays in Glance
- material weather can become a Home card only when relevant
- source failure removes/stales weather rather than inventing a fallback number
- cache/freshness state is observable

### Gate 4 — Municipal benefits

Start with Vitacura official sources only.

Acceptance:

- verified locality match
- explicit validity or ongoing status
- source link available
- no undated/uncertain benefit is presented as currently active

### Gate 5 — Local news

Start with Vitacura official/local sources.

Acceptance:

- freshness enforced
- duplicate stories grouped/removed
- only locally useful items reach Home
- Home remains sparse when there is nothing useful

### Gate 6 — Mobility

Order: Metro operational status, then route context, then DTPM stop ETA when real-time access is available.

Acceptance:

- journey duration is never presented as stop ETA
- no demo ETA is shown as live
- disruption can escalate to AHORA/alert
- normal service remains compact in Glance

### Later gates

Community, School, Care/Event, Commerce, Delivery, Health, Vehicle and Pets connect through domain adapters after the first six gates are stable. Generic feeds do not enter Home; only relevant actions, state changes, schedules, deadlines and useful-today information do.

## Branch discipline

`main` is not used as an experimentation surface. Each gate must have a known-good commit. If a later gate breaks the simulator, return to the last visibly confirmed gate instead of layering another workaround on top.

## Source-of-truth direction

The current overlay-to-local-app sync remains a temporary recovery path. The long-term target is for the runnable mobile application itself to become the tracked source of truth, with shared domain logic imported through stable package/module boundaries rather than copied files with relative-path rewrites.
