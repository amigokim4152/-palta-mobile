# PALTA DESIGN PRIMITIVES — CANDIDATE v1

Status: IMPLEMENTATION CANDIDATE / NOT FROZEN
Branch: `integration/design-system-v1`
Gate: A — Visual primitives and semantic tokens

## Purpose

Provide one centrally controlled candidate scale for prototype and device measurement without pretending that unfinished brand decisions are final.

Domain workstreams MUST NOT copy these values into local design systems. They consume shared tokens/components.

## 1. What is intentionally NOT decided here

- final Palta green or any brand hex value
- final light/dark palette
- official typeface family
- final symbol geometry
- final icon drawing geometry/stroke
- final shadow recipe per platform
- final motion duration/easing/spring values

Those remain upstream-controlled or device-validation dependent.

## 2. Spacing candidate

Central candidate scale:

| token | px/dp |
|---|---:|
| none | 0 |
| xxs | 2 |
| xs | 4 |
| sm | 8 |
| md | 12 |
| lg | 16 |
| xl | 24 |
| xxl | 32 |
| xxxl | 48 |

Initial semantic mapping:

- dense inline separation: `xs` / `sm`
- normal content gap: `md`
- phone horizontal gutter: `lg`
- major section gap: `xl`
- major section break: `xxl`

Validation target: 320–430pt phone widths, ES-CL long labels, KO, Dynamic Type / font scaling.

## 3. Radius candidate

| token | px/dp | candidate use |
|---|---:|---|
| none | 0 | structural edges only |
| xs | 6 | small tags/status containers |
| sm | 10 | compact controls |
| md | 14 | inputs/standard controls |
| lg | 18 | cards |
| xl | 24 | sheets/large surfaces |
| pill | 999 | chips/pills only |

Rule: rounded does not mean every surface becomes a floating card. Use radius only when the component boundary is semantically useful.

## 4. Typography candidate

Font family remains UNFROZEN. Metrics below are for hierarchy and ES/KO/device testing.

| role | size | line-height | weight |
|---|---:|---:|---:|
| display | 32 | 38 | 700 |
| titleLarge | 24 | 30 | 700 |
| titleMedium | 20 | 26 | 600 |
| titleSmall | 18 | 24 | 600 |
| bodyLarge | 17 | 25 | 400 |
| bodyMedium | 15 | 22 | 400 |
| bodySmall | 14 | 20 | 400 |
| labelLarge | 15 | 20 | 600 |
| labelMedium | 13 | 18 | 600 |
| labelSmall | 12 | 16 | 600 |
| caption | 12 | 17 | 400 |
| numericProminent | 28 | 34 | 700 |

### Typography rules

- Avoid all-caps Spanish labels except established short status conventions.
- ES-CL text must not be designed around English-length assumptions.
- Korean line-height must be checked independently.
- Numeric business/POS contexts require tabular/aligned numeric behavior where the chosen font supports it.
- Accessibility scaling must not break primary actions or truncate critical status text.

## 5. Touch candidate

- absolute minimum interactive target: 44 × 44
- preferred primary action height/target: 48+
- visual icon may be smaller than the touch target
- adjacent destructive/confirm controls require sufficient separation

## 6. Elevation

Use semantic roles, not arbitrary shadows:

- `flat`: normal page content
- `raised`: meaningful surface separation
- `floating`: sheet/control floating above primary content
- `overlay`: modal/critical overlay layer

Exact iOS shadow, Android elevation and Web shadow recipes remain adapter work and require visual/device validation.

## 7. Color

Only semantic interfaces are approved now:

- background/base/elevated
- surface/default/subtle/selected
- text/primary/secondary/tertiary/inverse
- border/default/strong
- action/primary/secondary
- state/info/success/warning/critical/realtime/stale/disabled
- focus/ring

NO final hex values are approved by this document.
Do not sample the PNG logo to invent the product palette.

## 8. Motion

Approved meanings:

- micro: press/selection/toggle feedback
- standard: local state/sheet/filter transitions
- spatial: transitions that explain spatial continuity

Exact timing values remain NOT FROZEN until real-device measurement.
Reduce Motion must be respected.

## 9. Validation matrix

Before freezing this candidate:

1. Home surface
2. Neighborhood map + result sheet
3. Community feed/thread
4. ES-CL long labels
5. Korean labels
6. iOS Dynamic Type / Android font scaling equivalent
7. keyboard + safe-area behavior
8. 320–430pt phone widths
9. reduced-motion mode
10. light/dark candidate once upstream brand palette is ready

## 10. Implementation binding

Canonical code candidate: `src/ui/tokens.ts`.

Domain-local copies are prohibited. If a value changes after validation, it changes centrally and representative flows are regression-tested.
