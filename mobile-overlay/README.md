# Palta Mobile Overlay

`mobile-overlay/src` is the versioned mobile UI/source Source of Truth for the checked-out Palta integration branch.

It is no longer copied manually onto a freshly created Expo project. The repository contains a reproducible Expo SDK 57 shell at `apps/mobile`, and `scripts/sync-mobile-runtime.mjs` materializes this overlay into the gitignored `apps/mobile/src` runtime directory.

## Ownership

- `mobile-overlay/src` — mobile routes, screens, components, hooks, providers, adapters, and theme.
- repository `src` — framework-neutral Palta domain/core contracts.
- `apps/mobile` — Expo/native shell and locked dependencies.
- `apps/mobile/src` — generated runtime copy; never edit as a second Source of Truth.

## Current route contract

The overlay follows the application shell routes, including:

- `/business/[businessId]`
- `/care/[careTrackId]`
- `/context/[contextId]`
- `/search`
- `/map`

Legacy `/activity/[id]` redirects to the canonical Care route and should not be used for new code.

## Runtime verification

Prepare the current branch with:

```bash
bash scripts/bootstrap-mobile.sh
```

On macOS, run the native iOS path with:

```bash
bash scripts/run-ios-mobile.sh
```

GitHub CI also materializes the overlay into the Expo shell and typechecks the generated runtime. MapLibre still requires a native development build; Expo Go is not a valid native map verification environment.

The overlay must not contain fake production data, fake authentication, provider secrets, or a second copy of framework-neutral business logic.
