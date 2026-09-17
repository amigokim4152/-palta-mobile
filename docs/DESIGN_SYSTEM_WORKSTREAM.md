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

Status: CENTRAL CANDIDATE IMPLEMENTED / DEVICE VALIDATION PENDING

Implemented:
- semantic state names
- token namespace contract
- centralized ownership rule
- shared TypeScript token interface: `src/ui/tokens.ts`
- candidate spacing scale
- candidate radius scale
- semantic elevation roles
- typography hierarchy candidate for ES-CL/KO stress testing
- minimum/preferred touch-target candidate
- explicit rule that brand colors stay value-unfrozen

Not frozen:
- brand color values
- font family
- final type metrics
- final spacing/radius/elevation scale
- exact motion duration/easing/spring values

Reference: `docs/DESIGN_PRIMITIVES_CANDIDATE_V1.md`.

### Gate B — Palta Core Icon Set v1

Status: SEMANTIC REGISTRY IMPLEMENTED / VISUAL GEOMETRY PENDING

Implemented:
- functional icon/reaction/character separation
- no random emoji for core branded UI
- centralized canonical meaning requirement
- TypeScript icon registry: `src/ui/icons.ts`
- navigation/action/location/domain/trust/status semantic keys
- automated duplicate/emoji boundary check

Not frozen:
- final icon geometry
- stroke/fill policy
- optical metrics
- complete SVG/icon assets

Reference: `docs/PALTA_CORE_ICON_SET_V1.md`.

### Gate C — Core components + ES/KO length validation

Status: CONTRACT + QA CASES IMPLEMENTED / NATIVE RENDER ADAPTER PENDING

Implemented:
- shared TypeScript UI contracts: `src/ui/contracts.ts`
- shared export layer: `src/ui/index.ts`
- Button/Input/Card/BottomSheet/Status/Trust/Empty/Error/Profile contracts
- Community Post and Local Result cross-domain contracts
- ReactionBar and Character presentation contracts
- screen-pattern contract
- ES-CL and KO stress cases: `src/ui/localeQa.ts`
- framework-neutral platform adapter contract: `src/ui/platformAdapter.ts`

Pending:
- actual Expo/React Native runtime shell
- React Native adapter/components
- Web/PWA adapter where needed
- rendered ES-CL long-copy stress test
- rendered KO stress test
- Dynamic Type/font-scale device test

Reference: `docs/ACCESSIBILITY_LOCALE_QA_V1.md`.

### Gate D — Motion/Haptic/Gesture/Accessibility

Status: QA CONTRACT IMPLEMENTED / DEVICE VALIDATION PENDING

Implemented:
- shared required accessibility checks: `src/ui/accessibilityQa.ts`
- iOS/Android/Web capability boundary
- reduced-motion and dynamic-text adapter requirements
- minimum device validation matrix
- PASS / FAIL / NOT VERIFIED evidence rule

Pending:
- exact duration/easing/spring values
- platform haptic mappings
- real screen-reader/focus-order evidence
- keyboard/safe-area evidence
- real-device frame/performance evidence

### Gate E — Cross-surface consistency slice

Status: STRUCTURAL PROTOTYPE READY / DEVICE REVIEW PENDING

Implemented:
- Home slice
- Neighborhood Map + Result Sheet slice
- Community Feed/Thread slice
- same candidate spacing/typography/radius hierarchy across all three
- neutral placeholder palette so unfinished brand colors are not accidentally frozen

References:
- `docs/DESIGN_VERTICAL_SLICE_V1.md`
- `prototype/design-system-v1.html`

### Gate F — Character / Living Example / Reaction binding

Status: SEMANTIC RUNTIME BINDING IMPLEMENTED / FINAL ARTWORK PENDING

Implemented:
- six current canonical character IDs from Drive registry
- upstream PROVISIONAL status preserved
- sensitive-context suppression contract
- synthetic/example disclosure requirement
- six shared Reaction meanings
- Community `ReactionBarContract` uses registered Reaction keys
- automated guardrails against Unicode emoji as default product Reaction assets
- five current synthetic QA personas bound for cross-domain regression

Pending:
- final Character runtime assets
- final Reaction visual assets
- on-device visual/optical review

Reference: `docs/CHARACTER_REACTION_BINDING_V1.md`.

### Gate G onward

Pending representative real-domain integration, native render adapters and cross-domain regression.

## Automated guardrails

`npm run check:design-system` checks the Design System foundation for:

- required contract/registry files
- accidental brand hex freeze in `src/ui/tokens.ts`
- Unicode emoji in core icon and Reaction registries
- duplicate core icon semantic keys
- required shared semantic component contracts
- canonical Character IDs and provisional upstream status
- sensitive-context Character suppression
- ES-CL + KO locale QA coverage
- required accessibility QA checks
- five shared synthetic QA personas
- iOS/Android/Web platform-adapter boundary
- motion remaining explicitly unfrozen until device validation
- prohibition of domain-specific icon packs

`npm run verify` includes this check on the Design System branch.

## Verification status

- `src/ui` TypeScript contracts: PASS under TypeScript 5.8.3 strict settings before the latest Character/QA expansion; full branch re-verification required after current additions.
- GitHub branch-wide CI: NOT VERIFIED; no workflow/status run was attached to the Design System commits at review time.
- real-device UI measurement: NOT VERIFIED.
- final brand color/font/icon geometry: NOT FROZEN by upstream source, intentionally.
- final Character/Reaction artwork: NOT FROZEN by upstream source, intentionally.

## First implementation sequence

1. Semantic token interfaces — IMPLEMENTED
2. Typography roles — CANDIDATE IMPLEMENTED
3. Shared primitive interfaces — IMPLEMENTED
4. Core action/input/surface contracts — IMPLEMENTED
5. Header/search/chip/status/trust contracts — REGISTRY READY
6. BottomSheet/modal/toast/error/empty/loading contracts — REGISTRY READY
7. Icon meaning registry and canonical mappings — IMPLEMENTED
8. Home pattern structural prototype — READY
9. Discovery + Map/Sheet structural prototype — READY
10. Feed + Thread structural prototype — READY
11. Character/expression binding — IMPLEMENTED
12. Accessibility/state/locale QA checklist — IMPLEMENTED
13. Domain adoption guide — READY
14. Framework-neutral platform adapter — IMPLEMENTED
15. Native Expo/React Native shell + adapter — BLOCKED UNTIL RUNTIME SHELL EXISTS
16. Cross-domain regression — PENDING REAL ADAPTERS

## Design freeze policy

Values such as final brand color codes, official typeface choices, precise icon geometry, symbol geometry and light/dark variants are only frozen when their upstream source is approved.

Before freeze, code should expose semantic interfaces rather than hard-code provisional sampled values.

Implementation candidates such as spacing/radius/elevation/motion metrics may be prototyped centrally, but domain branches may not treat those candidate values as independent domain contracts.

## Completion gate

Do not declare Design System v1 complete simply because a prototype looks coherent. Completion requires reusable implementation, documented states and adoption by representative real flows across domains, plus mobile/locale/accessibility/loading/recovery/state-continuity verification.
