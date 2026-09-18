# Palta mobile runtime shell

`apps/mobile` is the runnable Expo SDK 57 shell for the current Palta branch.

## Source of truth

- Versioned mobile UI/source: `mobile-overlay/src`
- Generated runtime source: `apps/mobile/src` (gitignored)
- Repository/core contracts: root `src`

Never hand-edit `apps/mobile/src` as a second UI source of truth.

## Materialize the current branch

From the repository root:

```bash
node scripts/sync-mobile-runtime.mjs
```

This replaces only generated `apps/mobile/src` with the current branch `mobile-overlay/src` and rewrites relative imports that target the repository-level `src` tree.

## Run on iOS

```bash
bash scripts/run-ios-mobile.sh
```

Runtime baseline:

- Expo SDK 57
- React Native 0.86
- React 19.2
- Expo Router
- MapLibre React Native development build
- iOS bundle ID: `cl.somospalta.app`
- Android application ID: `cl.somospalta.app`
- deep-link scheme: `palta`

Expo Go is not the MapLibre verification environment. Use the development/native build for map verification.
