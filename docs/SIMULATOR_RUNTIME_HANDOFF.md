# Palta iOS Simulator runtime handoff

## Purpose

Get the existing local Expo app at `apps/mobile` back onto the iOS Simulator without rebuilding the project structure or merging work into `main`.

## Source branch

`integration/simulator-runtime-fix-v1`

`main` must remain untouched until integration verification is complete.

## Problems already fixed on this branch

1. `useAsyncResource` could enter a refresh/render loop when screens passed inline `isEmpty` or loader callbacks whose identity changed between renders.
   - The hook now stores the latest callbacks in refs and only uses `enabled` as the refresh callback dependency.
2. `.env.example` used `EXPO_PUBLIC_APP_ENV=local` while the runtime contract reads `EXPO_PUBLIC_ENV` and accepts only `development | preview | production`.
   - The example now uses `EXPO_PUBLIC_ENV=development`.
3. A safe simulator launcher now exists at `scripts/run-ios-simulator-safe.sh`.

## What the launcher does

The launcher intentionally does **not** switch the current git branch and does **not** merge into `main`.

It:

- verifies macOS, Node 22+, Git, npm, Xcode CLI, Simulator tooling and `lsof`
- requires the existing `apps/mobile/package.json`; it will not create or overwrite a new app shell
- fetches `integration/simulator-runtime-fix-v1` into its remote-tracking ref
- copies only the verified `mobile-overlay/src/hooks/useAsyncResource.ts` fix into the existing local Expo app
- backs up a different local hook into `/tmp/palta-simulator-backup-<timestamp>/`
- uses process-local simulator env values only; no `.env` file is overwritten
- starts or reuses the Palta mock API on port 8787
- runs the full mock API HTTP smoke test
- reuses a booted iPhone Simulator, otherwise prefers `iPhone 18 Pro`, otherwise the first available iPhone Simulator
- runs `npx expo run:ios --device <UDID>` to compile, install and launch Palta

## One-command start from the local repository

From inside the existing Palta repository on the Mac, fetch the branch and run the launcher from the remote-tracking ref. This avoids checking out the branch just to obtain the script:

```bash
git fetch origin integration/simulator-runtime-fix-v1:refs/remotes/origin/integration/simulator-runtime-fix-v1 && bash <(git show origin/integration/simulator-runtime-fix-v1:scripts/run-ios-simulator-safe.sh)
```

Expected local repository from the previous native run:

```text
~/Development/palta-mobile
```

If starting outside the repository:

```bash
cd ~/Development/palta-mobile && git fetch origin integration/simulator-runtime-fix-v1:refs/remotes/origin/integration/simulator-runtime-fix-v1 && bash <(git show origin/integration/simulator-runtime-fix-v1:scripts/run-ios-simulator-safe.sh)
```

## CI status requirement

Before using this branch as the simulator recovery source, both integration workflows must pass:

- Palta Core CI (`npm ci` + `npm run verify`)
- Palta Core Check (shell syntax + Typecheck + Core tests)

Actual iOS native execution remains **NOT VERIFIED** until this launcher is run on the Mac and the screen is observed.

## First runtime acceptance loop

Do not try to validate every Palta domain in the first run.

Validate this vertical slice first:

1. Home opens without a React update-depth loop.
2. Home shows mock status/useful-today cards.
3. Open `Barrio`.
4. If location is unset, use the development location.
5. Local search returns the mock businesses.
6. Open a business detail.
7. Trigger `quote`.
8. POST `/v1/care` creates a Care track and routes to `/care/[careTrackId]`.
9. Care shows `wait` state and expected time.
10. `Volver a Inicio` returns to Home.
11. Home remains stable and does not continuously refresh.

This proves the first Palta execution loop:

`DISCOVER -> ACT -> HOME -> FOLLOW-UP`

## Intentionally deferred from the first simulator acceptance

- production Supabase authentication
- real Apple/Google login
- production MapLibre style endpoint
- push notification delivery
- Community integration
- Message Core integration
- Journey/transport integration
- Commerce/POS integration
- News integration

Those should be attached to the runtime one domain at a time after the first vertical slice is stable.
