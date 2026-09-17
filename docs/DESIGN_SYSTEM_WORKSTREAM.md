# PALTA DESIGN SYSTEM WORKSTREAM

Status: ACTIVE
Branch: `integration/design-system-v1`

## Mission

Build and maintain the shared visual/interaction language used by every Palta domain without blocking parallel functional development.

This workstream is an implementation bridge. It does not replace the existing Brand Master or PALTA Experience Foundation.

## This workstream owns

- design token interfaces and implementation status
- typography roles
- iconography registry/language
- shared primitives
- shared components
- shared screen patterns
- motion implementation rules
- accessibility baseline implementation
- brand asset runtime binding
- character/expression integration rules
- component documentation and QA
- cross-domain adoption guidance

## This workstream does not own

- Community domain logic
- Local Business domain logic
- Market domain logic
- Transport routing/data logic
- Health domain logic
- Messaging domain logic
- POS/business rules
- authorization/data schemas unrelated to UI
- independent reinterpretation of the Palta brand

## Required upstream sources

Use this precedence:

1. Google Drive `Somos Palta / 00_Foundation / 01_Brand_Design_System`
2. `PALTA BRAND MASTER — Logo & Asset Registry v1`
3. `PALTA_SYMBOL_MASTER_V1 — Especificación Canónica`
4. `PALTA Experience Foundation v1`
5. `PALTA Character & Living Example System v1 — Implementation Spec`
6. `docs/PALTA_DESIGN_SYSTEM_CONTRACT.md`
7. `docs/DESIGN_TOKEN_REGISTRY_V1.json`
8. `docs/COMPONENT_REGISTRY_V2.json`
9. `docs/PALTA_ICON_CHARACTER_LANGUAGE.md`
10. `docs/DESIGN_SYSTEM_AUDIT_2026-09-17.md`

Domain notes and temporary prototypes are lower-precedence sources and may not contradict these.

## Existing Experience Foundation principles to preserve

- Useful before decorative
- Recognize before read
- Quiet until needed
- Human, not childish
- One meaning, one expression
- Everything earns its place
- Progressive disclosure
- Mobile reality first

The implementation must also preserve shared semantics across Visual + Motion + Haptic + Sound, state restoration, map/list synchronization, es-CL/ko locale support, loading/recovery behavior and real-device quality gates.

## Parallel-development rule

Other workstreams continue implementing domain logic immediately.

Until shared UI components are production-ready:
- domain prototypes may use neutral structural placeholders
- those placeholders are not final visual decisions
- domain workstreams should avoid polishing unique component styles
- hard-coded brand styling must not become a domain contract
- final icon/emoji/character decisions stay centralized

When shared components become available:
- new production UI adopts them directly
- existing prototypes migrate progressively
- duplicated shared components are removed

## Request protocol for domain workstreams

When a domain needs UI not covered by the registry, record:

- semantic need
- user action/problem solved
- required states
- whether it is reusable outside the domain
- accessibility constraints
- data freshness/trust states if applicable
- locale/long-copy constraints
- loading/offline/error states

Do not request appearance first. Request behavior and semantics first.

## Gate status — 2026-09-17

### Gate A — Visual primitives + semantic tokens

Status: IN PROGRESS

Ready:
- semantic state names
- token namespace contract
- centralized ownership rule

Not frozen:
- brand color values
- font family/exact type metrics
- final spacing/radius/elevation numeric scale

### Gate B — Palta Core Icon Set v1

Status: IN PROGRESS

Ready:
- functional icon/reaction/character separation
- no random emoji for core branded UI
- centralized canonical meaning requirement

Not frozen:
- final icon geometry
- stroke/optical metrics
- complete icon assets

### Gate C — Core components + ES/KO length validation

Status: CONTRACT READY / IMPLEMENTATION PENDING

Registry v2 defines the first shared primitives, components and patterns. Real component implementation and locale stress tests are still pending.

### Gate D — Motion/Haptic/Gesture/Accessibility

Status: BASELINE APPROVED / NUMERIC IMPLEMENTATION PENDING

Meaning categories are stable. Exact duration/easing/spring values require real-device testing.

### Gate E onward

Pending representative vertical slices and cross-domain adoption.

## First implementation sequence

1. Semantic token interfaces
2. Typography roles
3. Shared primitive interfaces
4. Core action/input/surface components
5. Header/search/chip/status/trust components
6. BottomSheet/modal/toast/error/empty/loading states
7. Icon meaning registry and canonical mappings
8. Home pattern implementation
9. Discovery + Map/Sheet pattern implementation
10. Feed + Thread pattern implementation
11. Character/expression binding
12. Accessibility/state/locale QA checklist
13. Domain adoption guide
14. Cross-domain regression

## Design freeze policy

Values such as final brand color codes, official typeface choices, precise icon geometry, symbol geometry and light/dark variants are only frozen when their upstream source is approved.

Before freeze, code should expose semantic interfaces rather than hard-code provisional sampled values.

Implementation candidates such as spacing/radius/elevation/motion metrics may be prototyped centrally, but domain branches may not treat those candidate values as independent domain contracts.

## Completion gate

Do not declare Design System v1 complete simply because a prototype looks coherent. Completion requires reusable implementation, documented states and adoption by representative real flows across domains, plus mobile/locale/accessibility/loading/recovery/state-continuity verification.
