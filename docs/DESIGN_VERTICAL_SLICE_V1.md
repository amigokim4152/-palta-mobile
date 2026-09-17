# PALTA DESIGN VERTICAL SLICE v1

Status: ACTIVE VALIDATION PLAN
Branch: `integration/design-system-v1`

## Goal

Validate that one Palta design language can support three structurally different surfaces before domain teams polish their own screens:

1. Home — relevance/action hierarchy
2. Neighborhood — map + synchronized result sheet
3. Community — feed + post/thread actions

Passing only one attractive screen is insufficient.

## Shared rules across all three

- one dominant purpose per screen
- common horizontal gutter and spacing scale
- common typography roles
- common button/input/chip/status contracts
- same trust/freshness semantics
- same loading/error/empty language
- same icon semantic registry
- no domain-specific color systems
- no random Unicode emoji as product UI
- no dense portal/menu grids
- content can end naturally; do not fill space for appearance

## Slice A — Home

Purpose: show what matters now/next without becoming a portal.

Required structures:

- compact Palta/locality header
- relevant action/status card
- useful informational card only when relevant
- compact section label/hierarchy
- clear completion/next-action state
- natural empty/quiet end state

Must test:

- zero urgent items
- one urgent/actionable item
- 3–5 mixed candidates
- stale data
- offline cached content
- ES-CL long text
- KO text

## Slice B — Neighborhood map

Purpose: explore nearby places/services while keeping geographic context.

Required structures:

- locality-preserving search
- shared filters/chips
- map viewport
- selected result state
- synchronized bottom sheet/list
- trust/freshness state
- clear current-location/search-area distinction

Must test:

- no results
- loading
- degraded/offline map data
- stale place data
- one selected result
- many clustered results
- keyboard-open search
- map/list back-state restoration

## Slice C — Community

Purpose: read and participate in a trusted community context.

Required structures:

- community context header
- canonical profile identity
- post content
- media attachment area
- reaction/action row
- comment/thread hierarchy
- moderation/report states
- blocked/muted author handling

Must test:

- normal post
- long Spanish post
- Korean post
- post with media
- moderated content
- hidden content
- blocked author
- zero/large reaction counts
- comment/reply depth handling

## Consistency checks

The three slices must answer YES to all:

1. Do titles/body/labels have the same hierarchy?
2. Do primary actions look and behave the same?
3. Do selected/disabled/loading/error states mean the same thing?
4. Is spacing rhythm visibly the same product?
5. Does trust/currentness look identical across domains?
6. Does Back restore previous state?
7. Can the user distinguish content from action without decorative noise?
8. Does the interface survive long ES-CL and KO strings?
9. Are touch targets comfortable without making the UI oversized?
10. Does each screen avoid inventing local visual conventions?

## Current prototype

`prototype/design-system-v1.html`

Purpose: structural visual consistency review only.
It intentionally uses neutral placeholder color values because final brand color values and icon geometry are not frozen.

## Pass criteria

Gate A/B does NOT pass because the prototype looks pleasant.

It passes only when:

- shared token interfaces compile
- shared component contracts compile
- semantic icon registry is used
- all three slices can be represented without local design forks
- ES-CL/KO layout review is completed
- real-device measurements are recorded
- unfrozen upstream items remain clearly marked as unfrozen
