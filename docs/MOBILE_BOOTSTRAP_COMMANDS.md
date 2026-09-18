# Palta Mobile Bootstrap

Palta no longer creates a fresh Expo app during bootstrap. The repository contains a versioned Expo SDK 57 runtime shell at `apps/mobile`.

## Source of Truth

- `mobile-overlay/src` = versioned mobile UI/source for the checked-out branch.
- repository `src` = framework-neutral Palta core/contracts.
- `apps/mobile` = versioned native/Expo execution shell.
- `apps/mobile/src` = generated runtime material; never edit or commit it as a second UI Source of Truth.

## Prepare the current branch

From the repository root:

```bash
bash scripts/bootstrap-mobile.sh
```

The script:

1. runs repository safety checks;
2. refuses to create a second Expo app;
3. requires Node 22+;
4. materializes the current branch's `mobile-overlay/src` into `apps/mobile/src`;
5. rewrites only relative imports that target repository-level `src` for the deeper runtime path;
6. installs the exact locked mobile dependencies with `npm ci`.

Do not replace this with `create-expo-app@latest`. That would allow the native baseline to drift away from Expo SDK 57.

## iOS Simulator

On macOS with a working Xcode installation:

```bash
bash scripts/run-ios-mobile.sh
```

The launcher uses the current checked-out branch. It does not fetch an older simulator recovery branch or overwrite selected UI files from another branch. It materializes the current overlay, verifies the mock API, reuses or boots an available iPhone Simulator, then runs the native Expo development build.

## MapLibre

Palta uses `@maplibre/maplibre-react-native` through the shared Map Core. Expo Go is not the MapLibre verification environment. Native map behavior requires an iOS/Android development build.

Business, Property, Mobility, Events, Community, and other surfaces must consume the shared map/runtime contracts rather than initialize independent map engines.

## Verification

The `Palta Mobile Runtime Shell` GitHub workflow verifies:

```text
launcher shell syntax
-> current overlay materialization
-> locked dependency installation
-> generated app TypeScript
-> resolved Expo app identity
```

Resolved identity must remain:

- app name: `Palta`
- slug: `palta`
- scheme: `palta`
- iOS bundle identifier: `cl.somospalta.app`
- Android application ID: `cl.somospalta.app`

Compilation is not the final native verification. Simulator/real-device behavior, MapLibre rendering, permissions, deep links, notifications, accessibility, and performance still require native runtime checks.
