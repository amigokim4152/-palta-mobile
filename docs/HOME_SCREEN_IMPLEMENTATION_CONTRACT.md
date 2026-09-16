# PALTA Home Screen Implementation Contract
Version: v1.2
Status: IMPLEMENTATION-READY STRUCTURE / VISUAL TOKENS NOT FROZEN

## Product purpose

Home answers one question:

**"What matters in my life now?"**

It is not:
- a portal menu
- a module dashboard
- a social feed
- a news feed
- a feature directory
- a place that must look full

## Header

Keep the header compact.

Required:
- Palta brand mark / wordmark
- effective locality, compact and tappable
- optional notification/profile affordance

Do not add:
- large GPS setup blocks
- large account/settings blocks
- permanent category menus

## Candidate zones

Home is composed from candidate items. Zones are semantic, not fixed visual containers.

### 1. NOW
Use when:
- action is due
- appointment is near
- an important state changed
- deadline exists
- user must make a decision

### 2. IN_PROGRESS
Use when:
- waiting for response
- request submitted
- reservation exists
- quote/application is processing
- payment/transaction is in progress

### 3. USEFUL_TODAY
Use when:
- weather affects current life
- transit disruption matters
- local operational change matters
- public benefit/deadline is relevant
- school/community event is relevant

### 4. DISCOVER
Use when:
- personal/action cards are sparse
- information is still materially useful
- news/local events/culture are relevant

DISCOVER must never exist merely to fill vertical space.

## Composition rules

1. Personal state outranks generic content.
2. Changed state outranks unchanged reminder.
3. Action-required outranks passive reading.
4. Urgent/safety may escape Home into notification.
5. Home-worthy does not imply Push-worthy.
6. Already-completed work disappears or transforms.
7. Duplicates from one real-world event should group.
8. News may appear when life cards are sparse.
9. A busy Home demotes discovery.
10. If only three useful cards exist, show three.

## Card grammar

Use a small number of structural card types:

- ACTION
- STATUS
- ALERT
- USEFUL
- CONTENT

Domain is metadata, not a component family.

Avoid:
- HealthCard
- AutoCard
- SchoolCard
- PetCard
- NewsCard

as independently invented visual systems.

## Card anatomy

Optional:
- eyebrow / source
Required:
- concise title
Optional:
- one-line supporting text
Optional:
- time/state chip
Optional:
- one primary action
Optional:
- secondary overflow

Never force:
- image
- description paragraph
- multiple CTAs

## Quiet state

If there is nothing urgent:
- do not invent tasks
- show a calm state
- optionally show useful-today or discovery content

Example:
`Nada urgente por ahora`

This is a valid, successful Home state.

## Correction

Every personalized card must have a low-friction correction path:
- not relevant to me
- wrong person/asset
- already done
- incorrect information

Correction must not require opening a settings maze.

## Loading

Priority:
1. cached Home
2. stale-while-refresh
3. skeleton preserving layout
4. full blocking spinner only when unavoidable

## Offline

Offline behavior:
- show last known Home
- label stale data only when materially relevant
- preserve started user actions in local mutation queue
- do not drop Care state

## Deep link

Push must route to the exact Care/Context/Entity state.
Returning from detail restores the previous Home scroll position when practical.

## Measurement

Primary quality signals:
- tasks correctly surfaced
- unnecessary notifications avoided
- completed items removed/advanced
- user corrections decrease over time
- action completion
- time-to-understand

Do not optimize for:
- session length
- streaks
- number of cards viewed
