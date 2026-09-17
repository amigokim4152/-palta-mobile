# PALTA DESIGN SYSTEM — DOMAIN WORKSTREAM HANDOFF

Status: ACTIVE
Applies to: Community, Local Business, Market, Property, Jobs, Transport, Messaging, Health, Business/POS, Home and future Palta domains

## Mandatory startup check

Before implementing production UI, read:

1. `docs/PALTA_DESIGN_SYSTEM_CONTRACT.md`
2. `docs/DESIGN_TOKEN_REGISTRY_V1.json`
3. `docs/COMPONENT_REGISTRY_V2.json`
4. `docs/PALTA_ICON_CHARACTER_LANGUAGE.md`
5. `docs/CHARACTER_REACTION_BINDING_V1.md`
6. `docs/ACCESSIBILITY_LOCALE_QA_V1.md`

Then consume the shared implementation contract from `src/ui/index.ts` rather than copying token/component definitions into the domain.

If a domain's older UI note conflicts with these files, the shared Design System wins unless the upstream Brand/Experience master says otherwise.

## Shared code boundary

Current shared implementation files:

- `src/ui/tokens.ts`
- `src/ui/icons.ts`
- `src/ui/characters.ts`
- `src/ui/reactions.ts`
- `src/ui/contracts.ts`
- `src/ui/localeQa.ts`
- `src/ui/accessibilityQa.ts`
- `src/ui/qaPersonas.ts`
- `src/ui/platformAdapter.ts`
- `src/ui/index.ts`

Domain code should import shared types/semantic keys. It should not duplicate these files or create a competing `ui/constants`, icon pack, reaction map or brand palette.

## What domain workstreams should keep building now

Continue without waiting for visual freeze:

- domain entities and schemas
- permissions and role behavior
- APIs and adapters
- state machines
- business rules
- event/care/message contracts
- required user flows
- required component states
- accessibility requirements
- loading/offline/error/retry requirements
- analytics events

## What domain workstreams should not freeze locally

Do not create a domain-specific version of:

- colors
- typography system
- spacing/radius/elevation system
- primary/secondary buttons
- inputs/search fields
- cards/list rows
- chips/badges/trust marks
- bottom sheets/modals/toasts
- loading/error/empty patterns
- core navigation/action/status icons
- default reactions
- Palta logo/symbol variants
- Palta character families
- success/warning/error meanings

## Temporary UI rule

A workstream may use a neutral structural placeholder to test information architecture or behavior.

A placeholder must be treated as:

`STRUCTURAL PROTOTYPE — NOT VISUAL SOURCE OF TRUTH`

Do not spend time polishing a placeholder into a domain design system.

## Missing shared UI request

If a needed UI element does not exist in `COMPONENT_REGISTRY_V2.json`, provide the Design System workstream with:

- proposed semantic name
- user problem/action
- required states
- reusable domains
- data/trust/freshness states
- loading/offline/error states
- accessibility needs
- es-CL / ko long-copy needs

Do not submit only a visual description such as “make a green rounded card.”

## Community-specific adoption

Community owns post/comment/reply/moderation behavior. It does not own reaction semantics or generic UI primitives.

Use:

- `CommunityPostContract`
- `ReactionBarContract`
- `ReactionKey`
- `ProfileIdentityContract`
- shared trust/status/error/empty contracts

Do not introduce a Community-only emoji/reaction vocabulary as the default product UI.

## Local Business / Market / Property adoption

These domains own listing/business/property behavior and data. They share:

- semantic tokens
- `LocalResultContract` where applicable
- shared Search / Filter / Status / Trust patterns
- map/list state language
- common Empty/Error/Loading behavior

A domain may extend data fields but should not fork the visual primitive or state language.

## Messaging adoption

Messaging owns message/conversation behavior. It should reuse shared Profile/Status/Icon/Action contracts and request new generic components through the registry rather than defining an isolated visual system.

## Character / Living Example adoption

Use only canonical `CharacterId` values and `createCharacterUsage()` / `mayUseCharacterInContext()` semantics.

If final runtime artwork is unavailable, use a neutral structural fallback. Do not generate a local substitute character.

All Palta Living Example content must remain synthetic/example-labelled and analytically separated from real content.

## Icon / emoji rule

- User-authored emoji in posts/messages remains user content.
- Core navigation/action/status UI does not use arbitrary emoji.
- If a functional icon is missing, request a canonical Palta icon mapping.
- Reactions use `ReactionKey` / shared reaction assets.
- Characters use only the shared Palta character universe.

## Locale / accessibility rule

Every representative UI flow must be tested against both `es-CL` and `ko` stress cases.

Do not claim final accessibility PASS from static prototypes. Required checks and device evidence are defined in `src/ui/accessibilityQa.ts` and `src/ui/platformAdapter.ts`.

## Brand asset rule

Use official runtime derivatives only. Do not redraw or regenerate the logo/symbol and do not sample current PNGs to invent permanent brand color tokens.

## Adoption sequence when shared components land

1. Replace duplicated primitives first.
2. Replace shared actions/inputs/statuses.
3. Replace common cards/list rows/sheets.
4. Bind canonical icons/reactions/assets.
5. Apply domain pattern.
6. Run locale/accessibility/loading/error/state-restoration QA.
7. Remove obsolete domain-local visual constants/components.

## Completion check for a domain UI

A domain UI is not complete until it can answer YES to all applicable items:

- imports shared semantic contracts rather than copying them
- uses shared semantic tokens
- uses shared component registry where applicable
- has no unauthorized local brand constants
- has no random core emoji/icon substitutions
- uses official brand/character assets or approved neutral fallback
- supports es-CL and ko without layout breakage
- defines loading/offline/error/retry states
- preserves expected back/navigation state
- exposes accessibility semantics
- behaves coherently on mobile touch/keyboard/safe-area
- has not created a competing mini design system
