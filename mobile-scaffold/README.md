# Planned native source tree

Do not copy this directory blindly if the repository already contains a mobile shell. It is a topology guide for the Expo Router implementation.

```text
src/
  app/
    _layout.tsx
    (tabs)/
      _layout.tsx
      index.tsx
      neighborhood.tsx
      community.tsx
      market.tsx
      play.tsx
    place/[placeId].tsx
    business/[businessId].tsx
    care/[careTrackId].tsx
    context/[contextId].tsx
    search/index.tsx
    map/index.tsx
    modal/filter.tsx
    modal/location-picker.tsx
  components/
    core/
    home/
    map/
    business/
  core/
    contracts/
    adapters/
  features/
    home/
    neighborhood/
    community/
    market/
    play/
  services/
    api/
    cache/
    location/
    notifications/
  state/
    return-state/
    offline-mutations/
```

Rule: `src/app` contains routes only. Reusable UI/domain logic stays outside it.
