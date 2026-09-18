# Palta mobile runtime shell

`apps/mobile` is the reproducible Expo SDK 57 execution shell for Palta.

## Source-of-truth rule

- Versioned mobile UI/source lives in `mobile-overlay/src` on the checked-out branch.
- `apps/mobile/src` is generated runtime material and is intentionally gitignored.
- Never hand-edit `apps/mobile/src` as a second UI Source of Truth.
- Repository/core contracts remain in the repository-level `src` tree.

## Materialize the current branch

From the repository root:

```bash
node scripts/sync-mobile-runtime.mjs
```

The sync is destructive only inside generated `apps/mobile/src`: it replaces that directory with the current branch's `mobile-overlay/src` and rewrites only relative imports that target repository-level `src` so their extra directory depth is correct.

## Runtime baseline

- Expo SDK 57
- React Native 0.86
- React 19.2
- Expo Router
- MapLibre React Native development build
- iOS bundle ID: `cl.somospalta.app`
- Android application ID: `cl.somospalta.app`
- deep-link scheme: `palta`

Expo Go is not the MapLibre verification environment. Native MapLibre behavior must be verified with an iOS/Android development build.
