# Mobile Runtime Decision

## Decision

Use **Expo SDK 57 + React Native 0.86 + Expo Router** as the Palta native runtime baseline.

The executable shell is now versioned at `apps/mobile`; do not create a new shell with `create-expo-app@latest`.

## Runtime ownership

- `mobile-overlay/src` is the versioned mobile UI/source Source of Truth on each integration branch.
- repository-level `src` owns framework-neutral Palta contracts and domain logic.
- `apps/mobile` owns the reproducible Expo/native shell, lockfile, Metro configuration, and canonical app identifiers.
- `apps/mobile/src` is generated from the current branch's overlay and is gitignored. It must never become a parallel UI Source of Truth.

This separation lets Home, Community, Map, Commerce, and other integration branches change their mobile surfaces without maintaining stale copies inside a local-only Expo app.

## Baseline

- Expo SDK: 57
- React Native: 0.86
- React: 19.2.x
- Node: 22+
- Router: Expo Router
- Map: `@maplibre/maplibre-react-native`, shared Map Core only
- durable local data/cache: `expo-sqlite` where appropriate
- small sensitive device values: `expo-secure-store`
- notifications: Expo-facing adapter behind Palta notification contracts
- location: Expo Location behind Palta location contracts

Canonical mobile identity:

- name: `Palta`
- slug: `palta`
- scheme: `palta`
- iOS: `cl.somospalta.app`
- Android: `cl.somospalta.app`

## Build and provider position

The runtime must not force paid infrastructure. Expo/React Native and MapLibre can be used with local/native builds and Palta-owned infrastructure. EAS or other hosted providers may be used as replaceable implementation choices, not Foundation dependencies.

MapLibre requires a native development build; Expo Go is not the map verification environment.

## Bootstrap and launch

Prepare the current branch:

```bash
bash scripts/bootstrap-mobile.sh
```

Launch iOS Simulator on macOS:

```bash
bash scripts/run-ios-mobile.sh
```

Both paths use the current checked-out branch. They must not restore selected files from an older integration branch.

## CI contract

The mobile runtime workflow must materialize the current overlay, install the locked shell dependencies, typecheck the generated Expo app, and resolve the public Expo config to verify canonical app identity.

This makes runtime drift visible in CI instead of discovering it only after copying files manually on a developer Mac.

## Still adapter-level decisions

The runtime baseline does not itself lock:

- final auth provider
- final server-state/query library
- final analytics provider
- final push delivery provider
- final design-component library

Those remain adapter or implementation choices unless explicitly promoted to a platform contract.
