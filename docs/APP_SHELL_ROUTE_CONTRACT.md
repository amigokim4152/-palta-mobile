# App Shell & Route Contract v1

## Permanent primary navigation

`Home | Neighborhood | Community | Market | Play`

Map is not a sixth tab. Create/Post is not a sixth tab. Profile/My Palta is not a separate bottom tab; Home is the private personal surface.

## Planned native route topology

```text
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx                 # Home
    neighborhood.tsx
    community.tsx
    market.tsx
    play.tsx
  place/[placeId].tsx
  business/[businessId].tsx
  care/[careTrackId].tsx
  context/[contextId].tsx
  search/index.tsx
  map/index.tsx               # contextual shared map surface
  modal/
    filter.tsx
    location-picker.tsx
```

This is a route contract, not permission to duplicate canonical entities per route.

## Deep-link semantics

Every push that refers to a user-owned state must resolve to a stable semantic target rather than “open Home”. Examples:

- care track -> `/care/{careTrackId}`
- business/place -> `/business/{id}` or `/place/{id}`
- temporary life/travel context -> `/context/{contextId}`

The app may show the corresponding Home card on return, but the link target is the actual state object.

## State restoration

Back from detail must restore, where applicable:

- prior primary surface
- search query
- active filters
- list scroll position
- map viewport
- selected entity
- open sheet state when meaningful

A network refresh must not silently reset navigation state.
