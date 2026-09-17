# PALTA DESIGN SYSTEM WORKSTREAM

Status: ACTIVE
Branch: `integration/design-system-v1`

## Mission

Build and maintain the shared visual/interaction language used by every Palta domain without blocking parallel functional development.

## This workstream owns

- design tokens
- typography roles
- iconography registry/language
- shared primitives
- shared components
- shared screen patterns
- motion rules
- accessibility baseline
- brand asset runtime binding
- character/expression integration rules
- component documentation and QA

## This workstream does not own

- Community domain logic
- Local Business domain logic
- Market domain logic
- Transport routing/data logic
- Health domain logic
- Messaging domain logic
- POS/business rules
- authorization/data schemas unrelated to UI

## Required upstream sources

1. Google Drive `Somos Palta / 00_Foundation / 01_Brand_Design_System`
2. `PALTA BRAND MASTER — Logo & Asset Registry v1`
3. `PALTA Character & Living Example System v1 — Implementation Spec`
4. `docs/PALTA_DESIGN_SYSTEM_CONTRACT.md`
5. `docs/COMPONENT_REGISTRY_V2.json`
6. `docs/PALTA_ICON_CHARACTER_LANGUAGE.md`

## Parallel-development rule

Other workstreams continue implementing domain logic immediately.

Until shared UI components are production-ready:
- domain prototypes may use neutral structural placeholders
- those placeholders are not final visual decisions
- domain workstreams should avoid polishing unique component styles
- hard-coded brand styling must not become a domain contract

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

Do not request appearance first. Request behavior and semantics first.

## First implementation sequence

1. Semantic token interfaces
2. Typography roles
3. Shared primitive interfaces
4. Core action/input/surface components
5. Header/search/chip/status/trust components
6. BottomSheet/modal/toast/error/empty/loading states
7. Icon registry and canonical mappings
8. Home pattern implementation
9. Discovery + Map/Sheet pattern implementation
10. Feed + Thread pattern implementation
11. Character/expression binding
12. Accessibility/state QA checklist
13. Domain adoption guide

## Design freeze policy

Values such as final brand color codes, official typeface choices, precise icon geometry and light/dark variants are only frozen when their Brand Master source is approved.

Before freeze, code should expose semantic interfaces rather than hard-code provisional sampled values.

## Completion gate

Do not declare Design System v1 complete simply because a prototype looks coherent. Completion requires reusable implementation, documented states and adoption by representative real flows.