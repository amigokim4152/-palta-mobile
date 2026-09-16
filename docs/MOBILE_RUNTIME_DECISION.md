# Mobile Runtime Decision — 2026-09-16

## Decision

Use **Expo SDK 57 + React Native 0.86 + Expo Router** as the initial native runtime baseline for Palta.

Do **not** start on Expo SDK 58 beta. It entered beta on 2026-09-15 and is not the stable baseline yet.

## Why this fits Palta

- iOS/Android are the product target; web/PWA remains public/guest/share/admin/validation surface.
- Expo Router gives file-based native routing and deep linking, which matches Palta's Push -> exact state return requirement.
- Expo device modules cover location, notifications, camera/photo picker, haptics and secure local key/value storage without forcing a bespoke native shell on day one.
- MapLibre React Native works with Expo through a config plugin, but requires a **development build / prebuild**, not Expo Go. This is acceptable because Palta already needs custom native mapping.
- Core business logic remains framework-neutral TypeScript so public web and native surfaces can share contracts without sharing UI implementation.

## Initial native/runtime baseline

- Expo SDK: 57 stable
- React Native: 0.86
- React: 19.2.x
- Node: >= 22.13.x for SDK 57 tooling
- Router: Expo Router
- Map: @maplibre/maplibre-react-native, shared Map Core only
- Local durable cache: expo-sqlite for canonical/cache/state-return data where persistence is useful
- Secrets/tokens on device: expo-secure-store only for small sensitive values; never store large personal graphs there
- Notifications: client-facing Expo notifications API behind Palta Notification Adapter; provider remains replaceable
- Location: Expo Location behind Palta Location Core

## Cost position

The runtime choice must not force paid infrastructure. Expo/React Native and MapLibre are usable without making EAS or a map SaaS the canonical provider. EAS may be used where convenient, but local/native builds and Palta-owned R2/PMTiles remain valid paths. Provider-specific push/build services stay behind adapters where practical.

## Explicit non-decisions

Do not lock these before repository/bootstrap verification:

- final auth provider
- final server-state/query library
- final analytics provider
- final push delivery provider
- final design-component library

They are adapters/implementation choices, not Foundation contracts.

## First bootstrap rule

Create the native shell only after the current integration branch is clean and Foundation contracts are present. Then bootstrap Expo SDK 57, add Expo Router, configure development builds, and add MapLibre only after the shell/navigation passes on a real device.
