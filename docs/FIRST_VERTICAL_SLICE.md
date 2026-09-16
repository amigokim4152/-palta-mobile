# First Vertical Slice — Local Business Life Loop

## Goal

Prove the Palta loop end-to-end before building many disconnected screens:

`DISCOVER -> ACT -> HOME -> FOLLOW-UP`

## User path

1. Home opens with current personal/state cards plus useful secondary information when appropriate.
2. User enters Neighborhood.
3. Neighborhood shows canonical Place/Business results using current or saved life area; exploring another area stays exploration-only.
4. User selects a Business.
5. Detail shows the minimum useful facts and one primary action.
6. User performs one test action: initially `save/regular`, then inquiry/quote/reservation when backend support exists.
7. Once a personal state exists, create/update one CareTrack.
8. Home receives a normalized HomeCandidate projection from that CareTrack.
9. A status change updates the same CareTrack; it does not create a parallel Home-only record.
10. Push, if warranted, deep-links to the exact CareTrack/detail state.
11. Completion removes the active task from Home when no further action is useful; durable history remains where appropriate.

## First backend-light slice

Before business messaging/reservations are operational, the first executable slice may use:

`Neighborhood -> Business -> Save/Regular -> Home relationship/status projection`

This proves routing, canonical IDs, state persistence, state return and Home projection without inventing a fake booking backend.

## Second slice

`Business -> Inquiry/Quote -> Waiting -> Response -> Compare/Choose -> Completion -> History`

Only start this once an actual server-side action endpoint exists.

## Acceptance gates

- one canonical Business ID survives every surface
- no duplicate Place/Business object created by Home or search
- exploring location never changes durable home/work area
- Back restores Neighborhood map/list context
- state survives app background/foreground
- offline/reconnect does not discard a user action already accepted locally
- Home receives useful state, not a copy of the entire Business screen
- content/news never displaces urgent personal work merely to create variety
- Push is not sent for engagement-only reasons
- test persona can repeat the same flow in at least two comunas without route-specific code
