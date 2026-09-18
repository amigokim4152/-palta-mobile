# Palta App Implementation Handoff v1

## Purpose

This package is a GitHub-ready staging layer extracted from the current Palta Foundation, Product Core, Experience Foundation, and Infrastructure Master. It does **not** replace those source-of-truth documents and it does not choose a mobile UI framework yet.

## Required reading before feature work

Before adding or changing a user-visible Palta feature, read the relevant repository contracts first.

For every user-visible surface, localized API field, search flow, notification, message, public-data surface, business surface, Community, Market, Care, Health, Transport, or future module, `docs/LOCALIZATION_RUNTIME_V1.md` is mandatory.

For every collector, import, research workflow, Local Business ingestion path, public-data source, market/catalog ingestion path, or country-layer source, `docs/DATA_SOURCE_GOVERNANCE_V1.md` is mandatory.

Feature branches must not create their own locale provider, language persistence, translated canonical enum, per-language duplicate domain objects, or screen-local machine-translation path. Language changes presentation; it must not silently change Chile region, currency, timezone, eligibility, policy jurisdiction, or canonical entity identity.

Data ingestion branches must not treat discovery as publication authority. A third-party platform can produce a verification candidate without being an approved canonical ingestion source. Factual fields must pass provenance/rights verification before canonical publication. Third-party photos, reviews, platform prose, copyrighted layouts/assets, and unclear personal contact data must not be copied into the public canonical dataset without an explicit permitted basis.

## First executable product loop

`DISCOVER -> ACT -> HOME -> FOLLOW-UP`

The first vertical slice should prove one real loop end to end rather than create many disconnected screens:

`Home -> Neighborhood -> Place/Business -> Detail -> Save/Regular -> Reservation/Queue/Inquiry -> Event/Care state -> Home return`

## Initial app shell

Primary mobile navigation remains:

`Home | Neighborhood | Community | Market | Play`

Map is a shared view/core, not a permanent bottom tab. Create/post actions are contextual, not a permanent bottom tab. Home is the private personal space; there is no separate “My Palta” tab.

## Core implementation boundaries

- `core/contracts`: shared canonical contracts used by every domain.
- `home`: candidate normalization, dedupe, relevance, priority, delivery and composition.
- `care`: long-running action state and follow-up. `RESULT != OUTCOME`.
- `location`: current/home/work/saved/exploring locations are distinct.
- `eligibility`: eligibility decisions and repeat-suppression/recheck logic.
- Future adapters: canonical data API, Map Core, Notification/Event Core, Search, Local Business, public data.

## Home behavior fixed for implementation

Home has no fixed “fill target”. Personal life/action/status cards take priority. When those are sparse, useful news, weather, local changes, benefits, events, and other discovery content may appear. Low-value content is not added merely to make the screen look full.

Notification is a separate decision. A card worthy of Home is not automatically worthy of Push. Discovery/news content defaults to Home-only; action-changing, deadline, appointment-change, safety, and comparable events may escalate.

## Initial technical rule

The package is deliberately UI-framework-neutral TypeScript. Do not lock Expo/React Native/Flutter/etc. until the repository and deployment constraints are intentionally selected. Core domain logic should remain importable by mobile and public web surfaces.

## Verification status

- TypeScript contracts: implemented in staging.
- Home sparse/busy behavior: covered by executable test.
- RESULT vs OUTCOME: covered by executable test.
- Explore-location vs life-area separation: covered by executable test.
- Eligibility suppression/recheck: covered by executable test.
- Real mobile navigation, map, push, deep link, offline cache, native gestures: NOT IMPLEMENTED.
- Provider/API integrations: NOT IMPLEMENTED.
- GitHub upload/CI: NOT VERIFIED until repository connection is restored.
