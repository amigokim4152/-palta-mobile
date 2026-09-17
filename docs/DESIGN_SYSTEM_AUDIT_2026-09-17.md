# PALTA DESIGN SYSTEM AUDIT — 2026-09-17

Status: ACTIVE REVIEW BASELINE
Branch: `integration/design-system-v1`

## Purpose

This audit reconciles the existing Palta brand/experience sources with the new implementation contract so parallel domain workstreams can continue without creating divergent UI systems.

## Sources reviewed

1. Google Drive `Somos Palta / 00_Foundation / 01_Brand_Design_System`
2. `PALTA BRAND MASTER — Logo & Asset Registry v1`
3. `PALTA_SYMBOL_MASTER_V1 — Especificación Canónica`
4. `PALTA Experience Foundation v1`
5. `PALTA Character & Living Example System v1 — Implementation Spec`
6. Existing runtime brand derivatives in `01_Master_Brand_Mark / 02_CURRENT_DERIVATIVES`
7. Existing repository contracts and prototypes

## Main finding

Palta does not lack a design direction. The direction already exists across Brand Master, Experience Foundation and Character System. The current problem is implementation fragmentation: domain workstreams can still create visual decisions without consuming one enforced shared implementation layer.

Therefore this workstream is an implementation bridge, not a competing brand source.

## Canonical precedence

When sources conflict, use this order:

1. Approved Brand Master / official brand assets
2. Approved Symbol Master geometry rules
3. PALTA Experience Foundation
4. Approved Character & Living Example System
5. PALTA Design System Contract in this repository
6. Component/Token registries in this repository
7. Domain-specific UI notes
8. Temporary prototypes

Temporary prototypes never override the Foundation.

## Freeze matrix

| Area | Current state | Domain may decide independently? | Next gate |
|---|---|---:|---|
| Product/experience philosophy | APPROVED BASELINE | No | enforce in implementation |
| Semantic state language | APPROVED BASELINE | No | token binding |
| Logo/runtime derivatives | AVAILABLE / controlled | No | bind official assets only |
| Master symbol geometry | NOT FINAL/FROZEN | No | vector geometry closure |
| Brand color values | NOT FROZEN | No | Brand Master color approval |
| Typeface family | NOT FROZEN | No | typography selection + ES/KO validation |
| Typography semantic roles | READY TO IMPLEMENT | No | component validation |
| Spacing/radius/elevation scales | IMPLEMENTATION CANDIDATE | No | mobile prototype measurement |
| Functional icon meanings | READY TO REGISTER | No | canonical icon set visual design |
| Functional icon geometry/style | NOT FROZEN | No | Palta Core Icon Set v1 |
| Reaction meanings | READY TO REGISTER | No | shared reaction asset set |
| Character universe | APPROVED DIRECTION | No | runtime asset binding |
| Motion categories | APPROVED BASELINE | No | device-tested numeric tokens |
| Haptic semantics | APPROVED BASELINE | No | platform mapping |
| Map/list interaction language | APPROVED BASELINE | No | vertical-slice regression |
| Loading/offline/recovery philosophy | APPROVED BASELINE | No | shared components |
| Accessibility baseline | REQUIRED | No | automated + device QA |

## Decisions effective immediately

### Domains MAY continue

- domain data models
- API/integration logic
- permissions/authorization
- state machines
- workflows and business rules
- event contracts
- navigation requirements as semantic flows
- accessibility requirements
- required UI states

### Domains MUST NOT freeze locally

- arbitrary brand colors
- arbitrary fonts
- independent spacing/radius/shadow systems
- independent button/input/card design systems
- independent navigation icon styles
- emoji as branded navigation/action/status icons
- independently redrawn Palta logo/symbol
- domain-specific character families
- unique success/warning/error meanings
- duplicate shared loading/error/empty patterns

## Existing Experience Foundation alignment

The repository Design System must preserve the following Experience Foundation principles:

- Useful before decorative
- Recognize before read
- Quiet until needed
- Human, not childish
- One meaning, one expression
- Everything earns its place
- Progressive disclosure
- Mobile reality first

It must also preserve:

- Visual + Motion + Haptic + Sound deriving from the same semantic meaning
- one shared Map Core / map-list selection state
- es-CL and ko locale support
- cached/stale-while-refresh and layout-preserving loading
- back/navigation state restoration
- push/deep-link return to the actual related state
- actual-device quality gates before Foundation freeze

## Brand asset conclusion

Current runtime PNG derivatives are valid as controlled implementation assets, but they are derivatives rather than the final vector master. They may be bound into the app as runtime copies. They must not be sampled to invent final brand tokens or independently altered.

## Icon / emoji conclusion

Palta requires three separate visual expression layers:

1. Functional icons — navigation/actions/status/utilities
2. Product reactions/micro-expression assets — appreciation/helpful/celebrate/concerned/etc.
3. Character universe — Living Examples/onboarding/local stories/selected empty states/social

Unicode emoji may remain user-authored content but must not become Palta's default product iconography.

## Immediate implementation order

1. Token status registry
2. Semantic token interfaces
3. Typography role contract without freezing a font family
4. Functional icon meaning registry
5. Core component behavior/state contracts
6. Home structural vertical slice
7. Map + result-sheet vertical slice
8. Feed/thread vertical slice
9. Device measurement for spacing/radius/motion candidates
10. Brand color/type/icon visual freeze when upstream masters are approved
11. Cross-domain adoption and regression

## Completion rule

Design System v1 is not complete when a static mockup looks consistent. It is complete only when representative real flows from multiple domains use the same tokens/components/patterns and pass mobile, locale, accessibility, loading/recovery and state-continuity verification.
