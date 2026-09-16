# PALTA Neighborhood Screen Implementation Contract
Version: v1.2
Status: IMPLEMENTATION-READY STRUCTURE / MAP PROVIDER NOT CONNECTED

## Product purpose

Neighborhood answers:

**"What around me is useful right now?"**

It joins:
- local businesses
- places
- services
- public facilities
- local events
- local changes

without creating separate maps.

## Entry state

Top area:
- compact locality
- search field
- optional compact filter entry

Main:
- shared Map Core

Bottom:
- draggable results sheet/list

## Spatial state model

One state object owns:

- effectiveLocation
- camera
- viewportBounds
- query
- activeFilters
- selectedEntityId
- resultIds
- sheetSnap
- mapMovedSinceSearch
- loadingState
- degradedState

Map and list never own separate selection state.

## Sheet snaps

Recommended semantic snaps:
- PEEK: one/few nearby results
- HALF: browsing list + enough map context
- FULL: list-first reading

Exact pixel heights are device-responsive and not frozen here.

## Search behavior

Typing search:
- keeps current location context
- updates result candidates
- does not reset map unless user asks

Moving map:
- does not automatically overwrite home area
- can expose `Search this area`
- sets exploring context, not a confirmed life fact

## Selection behavior

Tap marker:
- select entity
- highlight matching list card
- expose concise action sheet/card

Tap list item:
- select same entity
- focus map if useful
- preserve list position

Open detail:
- full route only when depth requires it

Back:
- restore viewport
- restore filters
- restore selected entity
- restore list/sheet state

## Location distinction

Never collapse these into one value:

- current_location
- home_area
- work_area
- saved_place
- exploring_location

Looking somewhere is not living there.

## Entity reuse

A business/clinic/school/park exists once canonically.

Map, search, Home, quote, reservation and history reference the same canonical entity.

## Business verification

Public facts may exist before owner verification:
- name
- category
- hours
- address/location
- public contact

Controlled actions require verified ownership where appropriate:
- discount/coupon
- paid offer
- sensitive price change
- business-only claim
- POS/financial operation

## Filter behavior

Filters are contextual and progressive.

Do not show every domain filter at once.

Examples:
- category
- open now
- distance
- verified
- service-specific filters

## Map visual density

Prefer:
- vector layers
- clustering
- source/layer rendering

Avoid:
- thousands of DOM/native marker views
- visual decoration without decision value

## Degraded/offline

If realtime/local API fails:
- retain last known valid data when useful
- show timestamp where currentness matters
- continue static map/base data when available
- do not make the whole screen fail because one provider failed

## First quality gate

Must verify on device:
- pan/zoom smoothness
- sheet/map synchronization
- marker/list selection continuity
- back restoration
- search this area
- GPS denied
- low network
- stale cache
- keyboard behavior
- safe area
