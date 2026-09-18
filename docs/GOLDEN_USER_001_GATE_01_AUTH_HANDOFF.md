# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: `RUNTIME_CONNECTED` — Auth Core, mobile runtime, canonical account bootstrap, RLS boundary, and public configuration validation are connected and automated. Live provider/device E2E is still `NOT VERIFIED`.

Gate 01 must **not** be changed to `E2E_VERIFIED` until the real mobile login → terminate/relaunch → logout → login-again cycle is executed against `palta-dev`.

## Source of truth

Use these together; do not create a competing Auth model:

1. `integration/golden-user-001-v1` — active Golden User branch
2. `integration/repository-normalization-v1` — normalized repository/database baseline
3. `integration/auth-profile-core-v1` — source of account/identity/session/resolver concepts already reconciled into the Golden branch
4. `integration/mobile-runtime-shell-v1` — historical Expo runtime/package reference only
5. Supabase project `palta-dev` (`rqbpbauhkdgsrkbwmkmg`) — real development target

The reconciliation deliberately does **not** restore the earlier independent `core_user`/identity persistence model. In normalized v1, `public.palta_account.user_id` is the canonical application id and is a FK to `auth.users(id)`.

## Implemented Auth boundary

Provider-specific Supabase SDK code remains under the mobile adapter/provider boundary. Core does not consume Supabase `Session` objects.

Identity layers are explicit:

- raw Apple/Google/email provider subject — upstream provider identity; not a Palta id
- `AuthBrokerUserId` — Supabase `auth.users.id`
- `PaltaUserId` — canonical application id resolved by Core

For normalized v1, `PaltaUserId` maps deterministically from `AuthBrokerUserId`, but the types remain distinct so raw provider subjects cannot silently become application ids.

Relevant Core files:

- `src/auth/accountModel.ts`
- `src/auth/accountResolver.ts`
- `src/auth/identityModel.ts`
- `src/auth/providerPrincipal.ts`
- `src/auth/sessionPolicy.ts`
- `src/ports/authPort.ts`
- `tests/auth-account-resolution-tests.ts`

## Implemented mobile runtime

Source of Truth remains `mobile-overlay/src`; generated runtime is materialized into `apps/mobile/src`.

Implemented controls and states:

- startup persisted-session check
- Apple OAuth button
- Google OAuth button
- email passwordless link flow
- PKCE callback handling (`palta://auth/callback`)
- SecureStore session persistence
- AppState token auto-refresh lifecycle
- loading/progress UI
- visible configuration/provider/account errors
- retry
- logout
- signed-in app gate

### Configuration hardening

The mobile Auth adapter is fail-closed:

- no Supabase project URL fallback exists in mobile source
- no concrete publishable key fallback exists in mobile source
- missing URL/key produces a visible `configuration_error`
- Supabase URL must match `https://<project>.supabase.co`
- mobile key must use the `sb_publishable_` format

`scripts/check-mobile-auth-secrets.mjs` rejects privileged Supabase material **and** hardcoded Supabase environment binding inside `mobile-overlay` / generated mobile source.

`.env.example` is the canonical public development configuration and is validated during root `npm run verify`. The prior stale `EXPO_PUBLIC_APP_ENV=local` contract was removed; the runtime now consistently uses `EXPO_PUBLIC_ENV=development|preview|production`.

For Golden User development on macOS, `scripts/run-ios-mobile.sh` injects the public `palta-dev` URL/publishable key at launch while allowing explicit environment overrides. This keeps application source environment-neutral while avoiding manual copy/paste for the development run.

## Canonical account bootstrap — `palta-dev`

A successful new `auth.users` row is handled by an internal database trigger:

- function: `palta_private.bootstrap_palta_account()`
- `SECURITY DEFINER`
- fixed `search_path`
- unintended public/anon/authenticated EXECUTE revoked
- trigger: `palta_account_bootstrap` after INSERT on `auth.users`
- operation: INSERT `public.palta_account(user_id)` with `ON CONFLICT (user_id) DO NOTHING`

The client does not create Palta accounts and authenticated INSERT privilege was not opened.

The repository migration is replay-safe in both environments:

- real Supabase: trigger/backfill executes when `auth.users` exists
- generic PostgreSQL CI: Supabase-only trigger section safely skips when `auth.users` is absent

## Verified `palta-dev` invariants — 2026-09-18

Direct database verification confirmed:

- `auth.users` exists
- `palta_account_bootstrap` trigger is enabled
- bootstrap function is SECURITY DEFINER with fixed search path
- `public.palta_account` RLS is enabled
- authenticated SELECT = allowed under owner RLS
- authenticated INSERT = denied
- authenticated UPDATE = denied by table grant at this stage
- authenticated DELETE = denied
- auth users missing a Palta account = 0 at verification time
- duplicate `palta_account.user_id` groups = 0

A transaction + rollback synthetic two-user test was executed against the real `palta-dev` database:

1. synthetic auth users A/B were inserted inside one transaction
2. trigger produced exactly two distinct `palta_account` rows
3. under `SET LOCAL ROLE authenticated` with JWT `sub = A`, A saw exactly its own account row
4. A saw zero rows belonging to B
5. transaction was rolled back
6. follow-up query confirmed zero synthetic auth/account rows remained

This verifies the server bootstrap invariant and negative owner-RLS boundary without leaving fixture residue.

## Latest automated verification evidence

Configuration-hardening baseline: `2aae9ebc8f9dd1e3264952ff34c7c7fb5027eaff` (`ci: validate canonical public env example`).

Successful GitHub Actions on that baseline:

- Palta Core Check run `35335940242`
  - TypeScript typecheck: PASS
  - Core tests, including canonical Auth/account resolution: PASS
- Palta Core CI run `35335940202`
  - `npm ci`: PASS
  - `npm run verify`: PASS
  - canonical `.env.example` validation: PASS as part of `verify`
  - mobile Auth secret/environment-binding guard: PASS as part of `verify`
  - PostgreSQL migration preflight: PASS
- Palta Mobile Runtime Shell run `35335940196`
  - launcher shell syntax: PASS
  - mobile Auth credential boundary: PASS
  - mobile overlay materialization: PASS
  - mobile dependency install: PASS
  - generated Expo runtime typecheck: PASS
  - canonical Expo public config resolution: PASS

## Definition of Done status

| # | Gate 01 requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 1 | Fresh install opens Auth when no valid session exists | `NOT VERIFIED` | Runtime logic exists; must execute on simulator/device |
| 2 | Golden User login works against `palta-dev` | `NOT VERIFIED` | Apple/Google/email live provider cycle not executed |
| 3 | Successful auth resolves exactly one canonical Palta account | `PARTIALLY VERIFIED` | Real DB trigger/idempotency verified; provider-driven login still requires E2E |
| 4 | Kill/relaunch restores same session/account | `NOT VERIFIED` | SecureStore/persistSession implemented and typechecked; device relaunch not executed |
| 5 | Sign out clears local session and returns to Auth | `NOT VERIFIED` | UI/runtime path implemented; device interaction not executed |
| 6 | Sign in again resolves same account | `NOT VERIFIED` | Requires live provider/device cycle |
| 7 | User A cannot read user B account | `VERIFIED` | Real `palta-dev` two-user transaction/RLS negative test |
| 8 | Missing/invalid config fails visibly and safely | `PARTIALLY VERIFIED` | fail-closed adapter + canonical env validation + visible error UI verified statically; live invalid-config interaction not executed |
| 9 | No private/admin key bundled in mobile | `VERIFIED` | publishable-only contract + mobile credential/environment-binding CI guard |
| 10 | Applicable TypeScript/tests/migrations pass | `VERIFIED` | runs `35335940242`, `35335940202`, `35335940196` |
| 11 | Runbook changes to E2E_VERIFIED only with runtime evidence | `VERIFIED` | remains `RUNTIME_CONNECTED` |

## Current Supabase advisor findings outside Gate 01

A 2026-09-18 security-advisor pass did **not** report the private Palta account-bootstrap function as exposed. It did report existing PostGIS/public-schema findings and one inaccessible RLS-with-no-policy table.

These are not modified inside Gate 01 because PostGIS relocation from `public` is not a safe one-line change on current PostGIS; it can require dependency backup/drop/recreate or a supported migration procedure. Do not disable/drop/move PostGIS merely to make the advisor list empty while Map Core depends on geo capability.

Track these separately during database/platform hardening:

- `business_registration_intake`: RLS enabled, no policies; current anon/authenticated CRUD grants were verified absent
- `spatial_ref_sys`: extension-owned public table advisor finding
- PostGIS installed in `public`: advisor warning; requires planned relocation strategy
- `st_estimatedextent(...)`: PostGIS SECURITY DEFINER execute warnings for anon/authenticated

The rule is: fix with a tested PostGIS migration plan, not an ad-hoc Gate 01 schema change.

## Remaining Gate 01 execution

Do not build Gate 02 yet. Remaining work is runtime evidence only:

1. on the development Mac, check out `integration/golden-user-001-v1`
2. run `./scripts/run-ios-mobile.sh`
3. confirm signed-out Auth surface
4. complete at least one Golden User login path against `palta-dev`
5. record the resulting `PaltaUserId`
6. terminate the app and relaunch; confirm the same session/account
7. logout; confirm Auth surface
8. login again; confirm the same `PaltaUserId`
9. exercise remaining configured providers and confirm they do not create unintended duplicate Palta accounts
10. only then change Gate 01 to `E2E_VERIFIED`

If a live provider fails, record the exact provider/configuration/deep-link failure and fix that blocker only. Do not advance to later product domains from this work package.
