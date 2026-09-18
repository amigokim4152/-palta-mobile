# Palta Home Functional Foundation v1

Status: ACTIVE FUNCTION-FIRST CONTRACT
Branch: `integration/home-functional-foundation-v1`

## Purpose

Home is the user's life inbox. It answers one question:

> What matters in my life now, and what can I do about it?

Visual design is intentionally not frozen here. This contract defines what Home must be able to do before final visual polishing.

## Required functional surfaces

### 1. Context header

Home must always know the effective context it is using.

Required capabilities:
- show effective locality
- allow locality/context correction
- expose notifications/inbox entry
- expose profile/account entry without turning Home into settings
- preserve household/person/asset scope when a card is about a child, vehicle, pet, business, or other subject

Current behavior:
- Home locality uses the resolved effective context rather than silently treating GPS as home.
- the profile surface exposes only minimal progressive-profile information.
- the notification entry opens a real inbox whose unread count is the same count shown on Home.

### 2. Glance

Ambient signals only. These do not become large cards unless they materially affect the user's day.

Supported classes:
- weather
- relevant transit/Metro operational state
- relevant stop ETA when verified realtime data exists
- air quality when locally meaningful
- other compact signals only when personalization makes them useful

Rules:
- no permanent filler slots
- no fabricated ETA or status
- unavailable source means omit or clearly unavailable, never silently substitute demo data
- demo signals are development-only and must be visibly distinguishable from production/live data during simulator QA

### 3. AHORA

The highest-value action or alert that requires attention now.

Examples:
- quote response that needs a decision
- payment/action required
- imminent appointment preparation
- transport disruption affecting a likely trip
- deadline due soon
- municipal/public-life deadline relevant to the user

Capabilities:
- one clear primary action
- exact deep link to the affected entity/process
- completion changes or removes the card
- urgent items may escalate to notification

### 4. EN CURSO

Tracks work already started and waiting states.

Examples:
- quote/request waiting for response
- reservation processing
- application/benefit request in progress
- payment/transaction processing
- Commerce order preparing/refund processing
- Community membership approval pending
- Care/Event workflow waiting for the next state

Capabilities:
- show last confirmed state
- show expected next step when known
- freshness/source state must be explicit internally
- never invent completion or expected times

### 5. PRÓXIMO

Confirmed future appointments, events, deadlines, renewals, and preparation steps.

Examples:
- medical appointment
- school deadline/event
- vehicle inspection/renewal
- pet vaccination/registration renewal
- reservation
- administrative deadline

Capabilities:
- confirmed schedule only
- can promote into AHORA inside an attention window
- preparation dependencies can generate their own action

### 6. PARA HOY

Useful information that materially helps today but does not require immediate action.

Examples:
- verified municipal benefit/service
- local operational notice
- relevant school/community notice
- seasonal food/local-life information
- recent local news
- nearby event/culture content when Home is otherwise quiet

Rules:
- personal/action state outranks this surface
- local news never fills space for appearance
- stale or unverifiable public information stays out
- ordinary Community posts, comments, reactions and raw unread counts stay on the Community surface

## Required cross-cutting capabilities

### A. Personalization and correction

Every personalized item must support a low-friction correction path where applicable:
- not relevant to me
- wrong person/asset
- already done
- incorrect information
- stop showing this type/source when appropriate

Corrections feed relevance and profile refinement; they are not just UI dismissals.

### B. Action and deep-link contract

A card with an action must open the exact context:
- Care track
- order
- quote
- appointment
- Community/school item
- municipal service/benefit
- news/source detail

An item declared as `action` must have a real executable target. If no target exists, it must be represented as an alert/status instead of a fake button.

Returning to Home should preserve state where practical and Home refreshes on focus so changed notification/lifecycle state is reflected.

### C. Source trust and freshness

Every source reports a mode:
- `live`
- `cached`
- `scheduled`
- `demo`
- `unavailable`

Every Home projection must define:
- source identity
- freshness/validity
- failure behavior
- whether stale data may remain visible

Demo data is development-only and must never be represented as live production data.

### D. Notification escalation

Home-worthy does not mean Push-worthy.

Notification should be reserved for:
- urgent/safety changes
- meaningful state changes
- deadlines/appointments inside configured attention windows
- user-requested alerts

Notification must deep-link to the exact Home context/entity.

The Home notification badge and Notification Inbox share one canonical unread state. Reading an item updates the same state that Home displays.

### E. Loading, cache, and offline

Priority:
1. cached Home
2. stale-while-refresh
3. skeleton preserving layout
4. blocking spinner only when unavoidable

Offline requirements:
- last-known Home remains readable
- materially stale information is identified
- started actions are queued safely where supported
- Care/Event state is not discarded

### F. Quiet state

An empty Home is valid.

If nothing matters now:
- show a calm state
- optionally show a small amount of genuinely useful today/discovery content
- never manufacture tasks or fill the page

## Domain capability map

| Domain/Core | Home contribution |
|---|---|
| Care/Event | AHORA, EN CURSO, PRÓXIMO |
| Weather | Glance; exceptional weather may promote |
| Mobility / stop realtime | Glance, AHORA, PARA HOY |
| Journey route planning | PARA HOY / AHORA only after contract reconciliation; route duration is not stop ETA |
| Municipal/public life | AHORA, PRÓXIMO, PARA HOY |
| Local news | PARA HOY / sparse discovery |
| School schedule | PRÓXIMO / AHORA via shared confirmed-schedule primitive |
| Community | EN CURSO for pending membership; PARA HOY for fresh pinned announcements; confirmed schedules use shared schedule primitive |
| CommerceOrder | AHORA, EN CURSO |
| CustomerDelivery | No Home lifecycle card; transport state for receipts/status messages. Palta Inbox delivery may create an Inbox notification. |
| Physical logistics/shipment | Future domain; no canonical Logistics Core currently exists in this repository |
| Health | Shared Care/schedule primitives ready; canonical Health Core pending |
| Vehicle | Shared schedule/subject primitives ready; canonical Vehicle Core pending |
| Pets | Shared schedule/subject primitives ready; canonical Pets Core pending |
| Seasonal food/local-life | PARA HOY only when timely/relevant |

## Function-first implementation order

Do not polish final visuals during this sequence.

1. Context header contract: locality + notification/profile entry points
2. Home payload contract: Glance + AHORA + EN CURSO + PRÓXIMO + PARA HOY
3. Card action/deep-link contract
4. Personalization correction actions
5. Source trust/freshness metadata
6. Cache/offline/quiet-state behavior
7. Care/Event projection
8. Confirmed schedule projection
9. Weather projection
10. Municipal benefit/service projection
11. Local-news projection
12. Mobility/Metro/bus projection
13. Community high-signal projection + school schedule reuse
14. CommerceOrder projection + CustomerDelivery boundary
15. Reconcile Journey branch without conflating trip duration and stop ETA
16. Add Health/Vehicle/Pets lifecycle adapters only after their canonical domain cores exist
17. Add physical logistics/shipment Home projection only after a canonical Logistics Core exists
18. Final visual design and motion polish after the functional set is visible

## Current implementation status

| Capability | Status | Notes |
|---|---|---|
| Functional Home payload + semantic surfaces | DONE | `Glance / AHORA / EN CURSO / PRÓXIMO / PARA HOY` contract exists and is validated. |
| Central Home Composer | DONE | Cross-domain validation, expiry, dedupe, ranking, section density and busy-Home content suppression are centralized. |
| `/v1/home` functional API | DONE | Backward-compatible flat `items[]` plus context, glance, surfaces, actions and freshness metadata. |
| Effective locality context | DONE | Explicit/current/home/saved contexts remain distinct; GPS is not promoted into a durable home fact. |
| Minimal Profile surface | DONE | Preferred name can be read/updated; language/timezone/country remain minimal progressive-profile context. |
| Notification Inbox | DONE | Real list/read transition/deep links; Home unread count is derived from the same inbox state. |
| Personalized correction intents | DONE | Not relevant, wrong subject, already done, incorrect information and hide-type have typed effects. |
| Real action/deep-link requirement | DONE | `kind: action` is invalid without an executable target. |
| Source trust / freshness | DONE | `live/cached/scheduled/demo/unavailable` and expiry rules are enforced. |
| Cache / offline startup | DONE | Last-known Home may render offline while expired realtime Glance signals are filtered independently. |
| Care/Event -> Home | DONE | Waiting, result, follow-up, blocked, completion and confirmed schedules map to Home semantics. |
| Confirmed schedule primitive | DONE | Shared by school/health/vehicle/pet/admin/reservation domains; unconfirmed dates do not enter PRÓXIMO. |
| Weather -> Home | DONE | Ordinary weather stays in Glance; material weather may promote. |
| Municipal benefits/services -> Home | DONE | Verification, locality, eligibility and validity gates are enforced. |
| Local news -> Home | DONE | Locality, recency, relevance and dedupe rules are enforced; unavailable news never becomes filler. |
| Bus ETA / Metro operational state -> Home | DONE | ETA requires verified realtime data; normal state stays compact, disruption may promote. |
| Journey route planning -> Home | PENDING RECONCILIATION | Existing Journey branch must be selectively reconciled; trip duration must never masquerade as stop ETA. |
| CommerceOrder -> Home | DONE | Only the authenticated customer's order is projected; payment/ready states promote, terminal states disappear. |
| Community -> Home | PROJECTION READY | Pending memberships and fresh pinned announcements have a narrow tested projection. Runtime/DB branch remains separate and must be selectively reconciled. |
| School -> Home | PRIMITIVE READY | Confirmed schedules already work through the shared schedule adapter; direct canonical school event source remains future work. |
| CustomerDelivery boundary | DONE | Canonical Commercial Core model/port selectively integrated; transport state is explicitly prevented from masquerading as physical delivery lifecycle. |
| Physical Logistics -> Home | NOT STARTED | No canonical shipment/logistics core exists in current repository branches. Do not invent one inside Home. |
| Health -> Home | PRIMITIVES READY | No canonical Health Core/branch exists; Care + schedule primitives are ready for later binding. |
| Vehicle -> Home | PRIMITIVES READY | No canonical Vehicle Core/branch exists; schedule/subject primitives are ready for later binding. |
| Pets -> Home | PRIMITIVES READY | No canonical Pets Core/branch exists; schedule/subject primitives are ready for later binding. |
| Safe simulator integration | DONE | Verified Map source and functional Home source are synchronized independently without switching the user's current branch or copying the whole overlay. |
| HTTP mock contract verification | DONE | `npm run verify` starts an isolated mock API and checks Home, Profile, Notification, Local Business and Care HTTP flows. |
| Final Home visual design | DEFERRED | Visual shell remains provisional until required functional bindings are visible and accepted in the simulator. |

## Cross-branch integration rules

The current repository contains intentionally diverged domain branches. Do not resolve them by wholesale merge into Home.

- `integration/community-runtime-v1`: reuse canonical Community authorization/repository/runtime pieces selectively. Do not overwrite the newer Home API/runtime work.
- `integration/commercial-core-v1`: reuse canonical Commerce/CustomerDelivery contracts selectively. Do not import the entire payment/fiscal/printing stack into Home.
- `integration/journey-client-v1`: reconcile Journey contracts selectively and keep route planning separate from stop-arrival realtime.
- `integration/simulator-runtime-fix-v1`: remains the verified source for Map/Barrio simulator recovery while Home uses `integration/home-functional-foundation-v1`.

## Definition of done for a Home capability

A capability is not complete because code exists. It is complete only when:
- its canonical data/input contract exists
- admission/relevance rule exists
- Home placement exists
- action/deep link works when applicable
- unavailable/empty behavior exists
- correction behavior exists when personalized
- source/freshness is explicit
- tests pass
- it is visible and inspectable in the simulator

## Explicitly not required before functional completion

These must not block the functional build:
- final icon set
- final animation timing
- final card radius/shadow
- exact final typography scale
- final Home visual density
- decorative illustrations

They will be resolved after the required functional behaviors are present and working.
