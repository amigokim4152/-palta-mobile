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
- delivery/order in progress
- application/benefit request in progress
- payment/transaction processing
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
- order/delivery
- quote
- appointment
- school item
- municipal service/benefit
- news/source detail

Returning to Home should preserve position/state when practical.

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

Demo data is development-only and must never be presented as live.

### D. Notification escalation

Home-worthy does not mean Push-worthy.

Notification should be reserved for:
- urgent/safety changes
- meaningful state changes
- deadlines/appointments inside configured attention windows
- user-requested alerts

Notification must deep-link to the exact Home context/entity.

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
| Mobility/Journey | Glance, AHORA, PARA HOY |
| Municipal/public life | AHORA, PRÓXIMO, PARA HOY |
| Local news | PARA HOY / sparse discovery |
| School | AHORA, PRÓXIMO, PARA HOY |
| Community | EN CURSO, PRÓXIMO, PARA HOY |
| Commerce/POS | AHORA, EN CURSO |
| Delivery | AHORA, EN CURSO, PRÓXIMO |
| Health | AHORA, EN CURSO, PRÓXIMO |
| Vehicle | AHORA, PRÓXIMO |
| Pets | PRÓXIMO, PARA HOY |
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
13. School/Community projection
14. Commerce/Delivery projection
15. Health/Vehicle/Pets lifecycle projection
16. Final visual design and motion polish after the functional set is visible

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