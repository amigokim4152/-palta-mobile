# PALTA DESIGN SYSTEM CONTRACT

Status: ACTIVE FOUNDATION CONTRACT
Version: 1.0
Scope: Palta mobile/web product UI across all domains
Owner approval basis: 2026-09-17

## 1. Purpose

Palta is developed in parallel workstreams. Community, Local Business, Market, Transport, Health, Messaging, Business/POS, Home and future domains MUST look and behave as one product.

This contract is the shared UI Source of Truth for implementation. Domain workstreams own domain behavior and data. They do not independently invent Palta visual language.

## 2. Source of Truth order

When UI decisions conflict, use this precedence:

1. Google Drive: `Somos Palta / 00_Foundation / 01_Brand_Design_System`
2. `PALTA BRAND MASTER — Logo & Asset Registry v1`
3. `PALTA Character & Living Example System v1 — Implementation Spec`
4. This document
5. `COMPONENT_REGISTRY_V2.json`
6. Domain-specific UI notes

Domain documents may extend the system but MUST NOT contradict levels 1–5.

## 3. Core product principles

- Mobile first.
- Palta is not a portal/menu dashboard. Screens should expose the next useful action or relevant information rather than dense category grids.
- One screen should have one dominant purpose.
- Information hierarchy comes before decoration.
- Do not fill empty space merely to make a screen look busy.
- Prefer calm, readable surfaces and clear hierarchy over visual novelty.
- Spanish copy must be supported without clipping or overly compact layouts.
- Accessibility and touch comfort are first-class constraints.
- Motion should communicate continuity/state, not decorate.

## 4. Mandatory implementation rules

Every workstream MUST follow these rules:

1. Do not create arbitrary color, radius, spacing, shadow, typography or motion values inside a domain screen.
2. Do not recreate shared buttons, cards, inputs, headers, chips, badges, sheets, modals, toasts or loading states inside a domain.
3. Use shared semantic tokens and registered components first.
4. If a reusable UI element is missing, propose/register it in the Design System instead of creating an isolated domain variant.
5. Domain logic and UI presentation must remain separable.
6. Do not recreate official Palta logo/symbol/wordmark with text, CSS, SVG drawing code or local approximations.
7. Do not introduce third-party emoji as primary branded UI language when a Palta icon/character asset exists or should exist.
8. Avoid hard-coded brand hex values until Brand Master color values are formally frozen.

## 5. Design token layers

### 5.1 Primitive tokens

Primitive values exist only inside the Design System.

- color palette
- spacing scale
- radius scale
- typography scale
- elevation/shadow scale
- opacity scale
- motion duration/easing
- icon size/stroke scale
- z-index/layer scale

### 5.2 Semantic tokens

Domain code should consume semantic names, not primitive values.

Examples:

- `color.background.base`
- `color.background.elevated`
- `color.surface.default`
- `color.surface.subtle`
- `color.text.primary`
- `color.text.secondary`
- `color.text.inverse`
- `color.border.subtle`
- `color.action.primary`
- `color.action.secondary`
- `color.status.success`
- `color.status.warning`
- `color.status.danger`
- `color.status.info`
- `space.screen`
- `space.section`
- `space.card`
- `radius.card`
- `radius.control`
- `motion.fast`
- `motion.standard`

Brand color values remain semantic placeholders until formally frozen in Brand Master.

## 6. Typography

Typography roles are shared across all domains:

- Display
- Screen title
- Section title
- Card title
- Body
- Secondary body
- Caption/meta
- Button/action
- Numeric emphasis

Rules:

- No domain-specific font family.
- No arbitrary font sizes in screen code.
- Spanish line length and diacritics must be verified.
- Dynamic text scaling must not break primary flows.

## 7. Shared UI primitives

The minimum shared primitive layer includes:

- PaltaText
- PaltaIcon
- PaltaSurface
- PaltaDivider
- PaltaButton
- PaltaIconButton
- PaltaInput
- PaltaAvatar
- PaltaImage
- PaltaPressable

Domains compose these; they do not fork them.

## 8. Shared components

Shared components cover repeated product behavior, including:

- PaltaHeader
- SearchBar
- FilterChip
- StatusBadge
- TrustStatus
- PrimaryAction
- SecondaryAction
- ContentCard
- ActionCard
- ListRow
- EmptyState
- ErrorState
- Skeleton
- BottomSheet
- Modal
- Toast
- ProfileHeader
- MediaStrip
- ContextMenu
- ConfirmationSheet

See `COMPONENT_REGISTRY_V2.json` for canonical names and states.

## 9. Shared screen patterns

A pattern is larger than a component. Domains reuse patterns and supply domain data/actions.

### Home pattern

Relevant item -> context -> next action. Do not convert Home into a directory of services.

### Discovery pattern

Search/filter -> result list or map -> detail -> action.

Used by Local Business, Market, Real Estate, Jobs, places and future discovery domains.

### Map + Sheet pattern

Map context + synchronized result sheet. Map movement and life-area identity are separate concepts.

### Feed + Thread pattern

Feed -> post/content -> comments/replies -> contextual actions.

Used by Community and compatible social/local content.

### Detail + Action pattern

Entity detail -> trust/status/context -> one primary next action -> secondary actions.

### Timeline / Care pattern

Current state -> what is next -> preparation -> deadline/status -> follow-up.

Used by care, appointments, service processes and lifecycle flows.

### Form pattern

Progressive disclosure, only requesting information when needed. Long forms should be sectional and resumable.

### Conversation pattern

Conversation -> context attachment (business/order/post/booking/etc.) -> action without losing thread context.

## 10. Navigation

Navigation is an app-level responsibility, not a domain responsibility.

- Shared app shell owns top-level navigation.
- Domain screens cannot add competing global navigation systems.
- Back behavior, modal behavior, sheet behavior and deep-link restoration must be consistent.
- Tabs represent stable product spaces, not every feature.

## 11. Iconography and branded expression

Palta must develop a coherent icon language rather than mixing arbitrary emoji, platform emoji and unrelated icon packs.

Rules:

- Functional controls use the canonical Palta icon registry.
- Icons use consistent geometry, optical weight, stroke/fill behavior and bounding boxes.
- Emoji may appear in user-generated text as user content, but must not be used as the default icon for core navigation/actions/status.
- Branded expressive assets (reactions, delight, onboarding, example content) use approved Palta character/expression assets.
- If a needed branded expression does not exist, register the need; do not improvise a one-off emoji replacement.

See `PALTA_ICON_CHARACTER_LANGUAGE.md`.

## 12. Character system

The approved Character & Living Example System is part of the brand language, not a separate decorative layer.

- Use the same character universe across app, QA, local stories, onboarding and social exports.
- Characters must come from the official character registry/assets.
- Do not redraw or create ad-hoc lookalike characters in domain workstreams.
- Characters are optional context enhancers; they must not appear on every card.
- Serious medical, disaster, death, violence/crime, high-risk legal/tax and high-risk financial contexts prioritize direct calm information UI over character-led expression.

## 13. States are part of design

Every reusable interactive component should define relevant states before it is considered complete:

- default
- pressed
- focused
- selected
- disabled
- loading
- success
- warning/error
- empty
- stale/degraded when data freshness matters

A screen that only defines the happy state is not finished.

## 14. Accessibility baseline

- Touch targets must be comfortably tappable.
- Text and controls must retain sufficient contrast.
- Meaning must not depend on color alone.
- Icons with non-obvious meaning require accessible labels.
- Loading, error and offline states must remain understandable.
- Motion must not be essential for comprehension.

## 15. Performance baseline

The Design System must not require heavy runtime decoration.

- Prefer reusable vector/icon assets or optimized official raster assets as appropriate.
- Avoid unnecessary image downloads for functional UI.
- Skeletons should match real layout closely to avoid layout shift.
- Animations should remain lightweight and interruptible.

## 16. Change control

### Domain workstream may

- compose existing components
- request a missing component/pattern
- add domain-specific content layouts when genuinely domain-specific

### Domain workstream may not

- fork the visual system
- redefine global tokens
- create a competing shared component with a different style
- recreate brand assets
- choose a new general icon family
- create independent character/emoji style

### Design System workstream owns

- tokens
- shared primitives/components
- icon language
- animation language
- common screen patterns
- visual accessibility standards
- shared component registry
- UI migration guidance

## 17. Parallel workstream protocol

Until Design System v1 is implemented:

- Domain logic, schema, API, authorization, state machines and data flows continue normally.
- Prototype UI may remain structurally neutral.
- Prototype visual choices are NOT product design decisions unless registered here.
- Final visual polish should wait for shared primitives/components where practical.

After Design System v1 is available:

- all new production UI must use it
- existing prototype screens are migrated progressively
- visual duplication is removed rather than preserved for backward compatibility

## 18. Definition of Done — Design System v1

v1 is ready for broad domain adoption when:

1. token interfaces exist
2. typography roles exist
3. shared primitive set exists
4. shared component registry is implemented
5. icon registry/usage rules exist
6. official brand assets are bound
7. character/expression usage rules are bound
8. Home pattern is validated in a real screen
9. Discovery/Map pattern is validated in a real screen
10. Feed/Thread pattern is validated in a real screen
11. light/dark or explicit single-theme policy is documented
12. accessibility and state QA checklist exists

## 19. Non-goal

Design System v1 does not need to pre-design every future Palta feature. It must provide a stable shared language that allows new domains to grow without fragmenting the product.