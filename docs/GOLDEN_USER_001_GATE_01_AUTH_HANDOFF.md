# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: `RUNTIME_CONNECTED` — implementation and database boundary are connected; live provider/device E2E is still `NOT VERIFIED`.

Gate 01 must **not** be changed to `E2E_VERIFIED` until the real mobile login → restart → logout → login cycle is executed against `palta-dev`.

## Source of truth

Use these together; do not create a competing Auth model:

1. `integration/golden-user-001-v1` — active Golden User branch.
2. `integration/repository-normalization-v1` — normalized repository/database baseline.
3. `integration/auth-profile-core-v1` — source of the account/identity/session/resolver concepts reconciled into the Golden branch.
4. `integration/mobile-runtime-shell-v1` — Expo runtime/package reference.
5. Supabase project `palta-dev` (`rqbpbauhkdgsrkbwmkmg`) — real development target.

The reconciliation deliberately does **not** restore the earlier independent `core_user`/identity persistence model. In normalized v1, `public.palta_account.user_id` is the canonical application id and is a FK to `auth.users(id)`.

## Implemented Auth boundary

Provider-specific Supabase SDK code remains under the mobile adapter/provider boundary. Core does not consume Supabase `Session` objects.

The identity layers are now explicit:

- raw Apple/Google/email provider subject — upstream provider identity; not a Palta id
- `AuthBrokerUserId` — Supabase `auth.users.id`
- `PaltaUserId` — canonical application id resolved by Core

For normalized v1, `PaltaUserId` maps deterministically from `AuthBrokerUserId`, but the types remain distinct so provider subjects cannot silently become application ids.

Relevant Core files:

- `src/auth/accountModel.ts`
- `src/auth/accountResolver.ts`
- `src/auth/identityModel.ts`
- `src/auth/providerPrincipal.ts`
- `src/auth/sessionPolicy.ts`
- `src/ports/authPort.ts`

The old Auth/Profile branch's account/identity/session/resolver concepts were reconciled. Its old independent account-id generator/storage tables were not copied.

## Implemented mobile runtime

Source of Truth remains `mobile-overlay/src`; generated runtime is materialized from it.

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

Mobile configuration accepts only a Supabase publishable key. A CI guard scans mobile sources for service-role/secret-key credential patterns.

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
- authenticated SELECT = allowed
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

## Automated verification evidence

Implementation baseline: `0b977f6716beada55dcc69ffd6caaabc61181288` (`refactor: reconcile Gate 01 auth with canonical account core`).

Successful GitHub Actions on that implementation:

- Palta Core Check run `35335051087`
  - TypeScript typecheck: PASS
  - Core tests including canonical Auth/account resolver test: PASS
- Palta Core CI run `35335051144`
  - `npm ci`: PASS
  - `npm run verify`: PASS
  - PostgreSQL migration preflight: PASS
- Palta Mobile Runtime Shell run `35335051197`
  - mobile overlay materialization: PASS
  - mobile dependency install: PASS
  - generated Expo runtime typecheck: PASS
  - Expo public config resolution: PASS

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
| 8 | Missing/invalid config fails visibly and safely | `PARTIALLY VERIFIED` | explicit error UI and publishable-key validation typechecked; live invalid-config runtime not executed |
| 9 | No private/admin key bundled in mobile | `VERIFIED` | publishable-only config plus `check:auth-secrets` CI guard |
| 10 | Applicable TypeScript/tests pass | `VERIFIED` | runs `35335051087`, `35335051144`, `35335051197` |
| 11 | Runbook changes to E2E_VERIFIED only with runtime evidence | `VERIFIED` | remains `RUNTIME_CONNECTED` |

## Remaining Gate 01 execution

Do not build Gate 02 yet. The remaining work is runtime evidence only:

1. launch the actual generated mobile runtime against `palta-dev`
2. confirm signed-out Auth surface
3. complete at least one Golden User login path; then exercise Apple/Google/email as configured
4. record the resulting `PaltaUserId`
5. kill the app and relaunch; confirm same session/account
6. logout; confirm Auth surface
7. login again; confirm the same `PaltaUserId`
8. only then change Gate 01 to `E2E_VERIFIED`

If a live provider fails, record the exact provider/configuration/deep-link failure and fix that blocker only. Do not advance to later product domains from this work package.
