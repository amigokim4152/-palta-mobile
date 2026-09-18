# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: `RUNTIME_CONNECTED` — Auth Core, mobile runtime, canonical account bootstrap, RLS boundary, live Auth capability discovery, and public configuration validation are connected. Live simulator/device E2E is still `NOT VERIFIED`.

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

Auth state subscriptions have separate state/error channels. If a provider session exists but canonical Palta account resolution fails, that failure is surfaced to the runtime error UI instead of being disguised as a normal `signed_out` event.

## Implemented mobile runtime

Source of Truth remains `mobile-overlay/src`; generated runtime is materialized into `apps/mobile/src`.

Implemented controls and states:

- startup persisted-session check
- live Supabase Auth capability discovery via `/auth/v1/settings`
- Apple OAuth action when Apple is enabled server-side
- Google OAuth action when Google is enabled server-side
- email passwordless link flow when email is enabled server-side
- unavailable providers are not shown as dead buttons
- adapter re-checks provider availability before beginning sign-in
- PKCE callback handling (`palta://auth/callback`)
- callback-code single-flight/deduplication so WebBrowser + Linking cannot exchange the same one-time PKCE code twice
- SecureStore session persistence
- AppState token auto-refresh lifecycle
- loading/progress UI
- visible configuration/provider/account-resolution errors
- retry
- logout
- signed-in app gate

### Live `palta-dev` Auth capability state — 2026-09-18

Public Auth settings were checked against the real development project.

- Auth settings endpoint: reachable
- Email Auth: **enabled** and required by CI
- Apple OAuth: **disabled at the Supabase project level**
- Google OAuth: **disabled at the Supabase project level**

Therefore the selected executable Golden User path is currently **email passwordless**. The mobile UI now reflects the server state dynamically, so Apple/Google buttons are hidden while those providers are disabled. When valid Apple/Google provider credentials are configured in `palta-dev`, the buttons can appear without another UI code change.

Apple/Google are not enabled here by inventing placeholder credentials. Their Supabase provider setup requires the real provider client identifiers/secrets (and Apple-specific credentials) from the relevant provider accounts.

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

Latest capability-aware Auth baseline: `5795418135bae8945e7dc3a0597e309eacd224c7` (`ci: require usable email Auth and observe social providers`).

Successful GitHub Actions on that baseline:

- Palta Core Check run `35337118230`
  - TypeScript typecheck: PASS
  - Core tests: PASS
- Palta Core CI run `35337118176`
  - `npm ci`: PASS
  - `npm run verify`: PASS
  - canonical `.env.example` validation: PASS
  - mobile Auth credential/environment-binding guard: PASS
  - PostgreSQL migration preflight and migration/RLS invariants: PASS
- Palta Mobile Runtime Shell run `35337118087`
  - launcher shell syntax: PASS
  - mobile Auth credential boundary: PASS
  - live `palta-dev` Auth settings endpoint: PASS
  - required email Auth readiness: PASS
  - Apple/Google readiness observed without making disabled optional providers fail the build
  - mobile overlay materialization: PASS
  - mobile dependency install: PASS
  - generated Expo runtime typecheck: PASS
  - canonical Expo public config resolution: PASS

A preceding strict provider-readiness run `35336804289` proved the Auth settings endpoint was reachable while both Apple and Google provider checks failed, establishing that those two providers are currently disabled rather than the endpoint being unavailable.

## Definition of Done status

| # | Gate 01 requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 1 | Fresh install opens Auth when no valid session exists | `NOT VERIFIED` | Runtime logic exists; must execute on simulator/device |
| 2 | Golden User login works against `palta-dev` | `NOT VERIFIED` | Email is enabled and selected; actual email login interaction still requires simulator/device E2E |
| 3 | Successful auth resolves exactly one canonical Palta account | `PARTIALLY VERIFIED` | Real DB trigger/idempotency verified; provider-driven login still requires E2E |
| 4 | Kill/relaunch restores same session/account | `NOT VERIFIED` | SecureStore/persistSession implemented and typechecked; device relaunch not executed |
| 5 | Sign out clears local session and returns to Auth | `NOT VERIFIED` | UI/runtime path implemented; device interaction not executed |
| 6 | Sign in again resolves same account | `NOT VERIFIED` | Requires live email/device cycle |
| 7 | User A cannot read user B account | `VERIFIED` | Real `palta-dev` two-user transaction/RLS negative test |
| 8 | Missing/invalid config and account resolution fail visibly/safely | `PARTIALLY VERIFIED` | fail-closed config + explicit subscription error channel + capability-aware error UI typechecked; live failure interaction not executed |
| 9 | No private/admin key bundled in mobile | `VERIFIED` | publishable-only contract + mobile credential/environment-binding CI guard |
| 10 | Applicable TypeScript/tests/migrations pass | `VERIFIED` | runs `35337118230`, `35337118176`, `35337118087` |
| 11 | Runbook changes to E2E_VERIFIED only with runtime evidence | `VERIFIED` | remains `RUNTIME_CONNECTED` |

## Current Supabase advisor findings outside Gate 01

A 2026-09-18 security-advisor pass did **not** report the private Palta account-bootstrap function as exposed. It did report existing PostGIS/public-schema findings and one inaccessible RLS-with-no-policy table.

These are not modified inside Gate 01 because PostGIS relocation from `public` is not a safe one-line change on current PostGIS; it can require dependency backup/drop/recreate or a supported migration procedure. Do not disable/drop/move PostGIS merely to make the advisor list empty while Map Core depends on geo capability.

Track these separately during database/platform hardening:

- `business_registration_intake`: RLS enabled, no policies; current anon/authenticated CRUD grants were verified absent
- `business_registration_intake_existing_business_id_fkey`: performance advisor reports no covering index; handle with the Local Business/data migration rather than Auth Gate 01
- `spatial_ref_sys`: extension-owned public table advisor finding
- PostGIS installed in `public`: advisor warning; requires planned relocation strategy
- `st_estimatedextent(...)`: PostGIS SECURITY DEFINER execute warnings for anon/authenticated
- unused-index notices on the low-traffic development database are not grounds to delete indexes before workload evidence exists

The rule is: fix with a tested database/PostGIS migration plan, not an ad-hoc Gate 01 schema change.

## Remaining Gate 01 execution

Do not build Gate 02 yet. Remaining work is runtime evidence, using the currently enabled email path:

1. on the development Mac, check out `integration/golden-user-001-v1`
2. run `./scripts/run-ios-mobile.sh`
3. confirm the signed-out Auth surface shows only currently enabled login methods
4. complete Golden User email passwordless login against `palta-dev`
5. record the resulting `PaltaUserId`
6. terminate the app and relaunch; confirm the same session/account
7. logout; confirm Auth surface
8. email login again; confirm the same `PaltaUserId`
9. when Apple/Google are later configured, verify those identities do not create unintended duplicate Palta accounts before treating them as production-ready login choices
10. only then change Gate 01 to `E2E_VERIFIED`

If the live email flow fails, record the exact email-template/redirect/deep-link/runtime failure and fix that Gate 01 blocker only. Do not advance to later product domains from this work package.
