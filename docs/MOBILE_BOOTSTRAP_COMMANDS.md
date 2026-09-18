# Mobile Bootstrap Commands — current Palta runtime

Status: ACTIVE

The repository already contains the versioned Expo/React Native shell under `apps/mobile`. Do **not** run `create-expo-app` and do not create a second mobile application.

## Source of Truth

- editable mobile UI/runtime source: `mobile-overlay/src`
- generated runtime source: `apps/mobile/src`
- native Expo shell and locked dependencies: `apps/mobile`
- runtime materializer: `scripts/sync-mobile-runtime.mjs`

Generated `apps/mobile/src` files must not become a second source of truth.

## Prepare the mobile runtime

From the repository root on an `integration/*` branch:

```bash
./scripts/bootstrap-mobile.sh
```

This command:

1. refuses unsafe repository state
2. materializes `mobile-overlay/src` into the current runtime
3. verifies Node 22+
4. installs the locked mobile dependencies with `npm ci`

## Launch Golden User on iOS Simulator

On macOS with a working Xcode/Simulator installation:

```bash
./scripts/run-ios-mobile.sh
```

The launcher:

- materializes the current overlay
- installs locked dependencies when needed
- starts and smoke-tests the local Palta mock API
- injects the public `palta-dev` Supabase URL and publishable key for the development run
- validates the public Auth configuration before launch
- reuses a booted iPhone Simulator or boots an available iPhone simulator
- builds and launches the current Palta branch with `expo run:ios`

The Supabase values used here are public client configuration, not service/admin credentials. They can be overridden by setting `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` before running the script.

## Public environment contract

Canonical example values live in `.env.example` and are validated by `npm run verify`.

Required variables:

```text
EXPO_PUBLIC_PALTA_API_BASE_URL
EXPO_PUBLIC_ENV
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

`EXPO_PUBLIC_ENV` must be one of:

```text
development
preview
production
```

Mobile Auth fails closed with a visible configuration error if Supabase URL/key are absent or invalid. Mobile source must not contain a hardcoded Supabase project URL, a concrete publishable key, a service-role key, or other privileged credential material; CI enforces this boundary.

## Auth Gate 01 verification order

Run this sequence before beginning Gate 02:

```text
fresh signed-out launch
-> Auth surface visible
-> complete one configured login path against palta-dev
-> confirm canonical PaltaUserId
-> terminate app
-> relaunch and confirm same session/account
-> sign out and confirm Auth surface
-> sign in again and confirm same PaltaUserId
-> verify remaining configured providers do not create duplicate Palta accounts
```

Compilation or typecheck alone is not E2E evidence.

## MapLibre and native modules

The runtime already includes `@maplibre/maplibre-react-native`, SecureStore, SQLite, Location, Notifications, Linking, and the current Expo dependencies in `apps/mobile/package.json` / lockfile. Do not reinstall or create alternate native shells merely to test these modules.

MapLibre requires an iOS/Android native development build; Expo Go is not the MapLibre verification environment. Business, Property, Mobility, and Events must continue to consume Shared Map Core instead of initializing competing map engines.

## Routine verification

Repository/core checks:

```bash
npm run verify
```

Environment contract using the canonical example:

```bash
npm run check:env-example
```

Local machine/repository readiness:

```bash
npm run preflight:local
```

Never mark native behavior `E2E_VERIFIED` solely because CI passes. Record the real simulator/device interaction evidence in `docs/GOLDEN_USER_001_GATE_01_AUTH_HANDOFF.md` and `docs/GOLDEN_USER_001_RUNBOOK.md`.
