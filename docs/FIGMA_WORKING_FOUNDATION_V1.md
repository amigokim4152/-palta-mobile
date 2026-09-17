# PALTA FIGMA WORKING FOUNDATION v1

Status: ACTIVE WORKING REFERENCE / NOT BRAND SOURCE OF TRUTH
Updated: 2026-09-17
Branch: `integration/design-system-v1`

## Purpose

This document binds the Palta Design System implementation contract to the current Figma working file. Figma is a visual validation and collaboration surface. It does not replace Google Drive Brand Master, Symbol Master, PALTA Experience Foundation or the GitHub implementation contracts.

## Figma file

Name: `Palta Design System v1 — Working Foundation`
File key: `AyZocGds73DgyXYmLbScqn`
URL: `https://www.figma.com/design/AyZocGds73DgyXYmLbScqn`

## Current page structure

The current Starter-plan file has reached its three-page maximum:

1. `00 Cover` — node `0:1`
2. `01 Getting Started` — node `4:4`
3. `02 Foundations` — node `4:6`

The intended additional Components/Utilities pages were not created because the connected Figma Starter team limits Design files to three pages per file. This is recorded as `BLOCKED — PLAN LIMIT`, not PASS and not a design-system failure.

Do not silently split the system into multiple Figma files and call that equivalent to the planned library structure without an explicit architecture decision.

## Phase 0 — Discovery

Status: PASS

Findings:

- blank Palta Figma file had no local variables, text styles or effect styles
- connected libraries include Material 3 Design Kit, Simple Design System and iOS/iPadOS resources
- external library Button/Input/Sheet patterns are useful platform references but do not match Palta's semantic state/trust/reaction/local-context contracts closely enough to become Palta's source of truth
- Palta therefore uses its own semantic implementation contract, with external libraries only as convention/reference material

## Phase 1 — Foundations

Status: PASS

### Collections

1. `Palta Working Primitives — NOT FROZEN`
   - collection id: `VariableCollectionId:2:2`
   - mode: `Neutral Validation`
   - variables: 32

2. `Palta Semantic Working — NOT FROZEN`
   - collection id: `VariableCollectionId:2:35`
   - mode: `Neutral Validation`
   - variables: 41

Total local variables: 73.

### Primitive values

Primitive numeric candidates mirror `src/ui/tokens.ts`:

- spacing: 0 / 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48
- radius: 0 / 6 / 10 / 14 / 18 / 24 / pill
- touch target: 44 minimum / 48 preferred primary
- layout: phone gutter 16, compact gutter 12, section gap 24, content gap 12, dense row gap 8

Working neutral colors exist only to render structural prototypes. They are explicitly named under `neutral/*` inside a collection named `NOT FROZEN`. They are not Palta brand color tokens.

### Semantic variables

41 semantic variables alias primitives. No semantic variable duplicates a raw value.

Covered namespaces include:

- `color/background/*`
- `color/surface/*`
- `color/text/*`
- `color/border/*`
- `color/action/*`
- `color/state/*`
- `color/focus/ring`
- `space/*`
- `radius/*`
- `size/touch/*`

All variables have explicit scopes. Validation found zero variables using `ALL_SCOPES`.

### Typography QA styles

12 text styles were created under `QA Candidate — NOT FROZEN/*`:

- Display
- Title/Large
- Title/Medium
- Title/Small
- Body/Large
- Body/Medium
- Body/Small
- Label/Large
- Label/Medium
- Label/Small
- Caption
- Numeric/Prominent

The metrics mirror `typographyCandidate` from code. Inter is used only as a Figma QA carrier font because the official Palta typeface is not frozen.

### Elevation QA styles

Three effect styles:

- `QA Candidate — NOT FROZEN/Elevation/Raised`
- `QA Candidate — NOT FROZEN/Elevation/Floating`
- `QA Candidate — NOT FROZEN/Elevation/Overlay`

Exact effect metrics remain implementation candidates pending device review.

### Readback validation

Validated after creation:

- collections: 2
- total variables: 73
- semantic variables: 41
- semantic aliases: 41/41
- variables with `ALL_SCOPES`: 0
- text styles: 12
- effect styles: 3
- Phase 1 result: PASS

## Phase 2

Status: BLOCKED — PLAN LIMIT

The intended file structure requires additional Components and Utilities pages. The current Figma Starter team file permits only three pages, all already occupied by Cover, Getting Started and Foundations.

Until the Figma workspace limitation changes or the file architecture is explicitly revised, do not mark Phase 2 complete and do not start a fake parallel Figma component library.

## Source-of-truth precedence

1. Google Drive Brand Master / official assets
2. Symbol Master
3. PALTA Experience Foundation
4. Character & Living Example System
5. GitHub `PALTA_DESIGN_SYSTEM_CONTRACT.md`
6. GitHub token/component/asset registries and `src/ui`
7. this Figma working file
8. temporary prototypes

## Important non-freeze rule

The following remain intentionally NOT FROZEN:

- final Palta brand colors
- official font family
- final type metrics
- final spacing/radius/elevation values
- final icon geometry/stroke/fill
- final symbol vector geometry
- final Character/Reaction artwork
- final motion timings/easings
- final light/dark appearance values

The existence of a working value in Figma does not promote it to a brand or product master value.
