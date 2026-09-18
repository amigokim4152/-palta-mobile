# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: `RUNTIME_CONNECTED` — Auth/Profile Core, composed mobile runtime, canonical account bootstrap, RLS boundary, public configuration validation, generated runtime typecheck, and composed iOS bundle are connected and verified. The complete live mobile/provider cycle is still `NOT VERIFIED`.

Gate 01 must **not** be changed to `E2E_VERIFIED` until the actual mobile login → terminate/relaunch → logout → login-again cycle is executed against `palta-dev` and resolves to the same canonical Palta account.

There is no Gate 01A/01B shortcut. A server-side synthetic fixture does not allow progression to Gate 02.

## Source of truth

Use these together; do not create a competing Auth model:

1. `integration/golden-user-001-v1` — Golden User orchestration/evidence branch
2. `integration/runtime-composition-v1` — whole-app iOS runtime/simulator Source of Truth
3. `integration/repository-normalization-v1` — normalized repository/database baseline
4. `integration/auth-profile-core-v1` — canonical Auth/Profile Core Source of Truth
5. `integration/mobile-runtime-shell-v1` — historical Expo runtime/package reference only
6. Supabase project `palta-dev` (`rqbpbauhkdgsrkbwmkmg`) — real development target

In normalized v1, `public.palta_account.user_id` is the canonical application id and is a foreign key to `auth.users(id)`.

The reviewed Auth/Profile source SHA integrated into the composed runtime is `a030511374d7a7a4b1383d5627f7d9ba4e6780aa`.

## Implemented Auth boundary

Provider-specific Supabase SDK code remains under the mobile adapter/provider boundary. Core does not consume Supabase `Session` objects.

Identity layers remain explicit:

- raw Apple/Google/email provider identity — upstream provider identity; not a Palta id
- `AuthBrokerUserId` — Supabase `auth.users.id`
- `PaltaUserId` — canonical application id resolved by Core

For normalized v1, `PaltaUserId` maps deterministically from `AuthBrokerUserId`, but the types remain distinct so raw provider subjects cannot silently become application ids.

The Auth/Profile Core exposes a small canonical runtime contract for broker-id normalization and canonical account verification. The composed mobile adapter uses that contract instead of copying the full persistence/profile model or creating a second Auth model.

Auth state subscriptions have separate state/error channels. A provider session that cannot resolve its canonical Palta account is surfaced to the runtime error UI instead of being disguised as `signed_out`.

## Implemented composed mobile runtime

Whole-app execution now belongs to `integration/runtime-composition-v1`. `mobile-overlay/src` is versioned source and `apps/mobile/src` is generated output.

Implemented controls and states:

- startup persisted-session check
- live capability discovery from Supabase Auth settings
- Apple OAuth when enabled
- Google OAuth when enabled
- email passwordless login when enabled
- PKCE callback handling through `palta://auth/callback`
- callback-code single-flight/deduplication
- SecureStore session persistence
- AppState token auto-refresh lifecycle
- loading/progress UI
- visible configuration/provider/account-resolution errors
- retry
- logout
- signed-in app gate around the existing composed app shell

At the latest verified `palta-dev` public provider state:

- Email Auth: enabled
- Apple Auth: disabled pending real provider credentials
- Google Auth: disabled pending real provider credentials

Disabled providers are not shown as dead buttons. When their Supabase provider configuration is enabled, the runtime can expose them without a new account model.

## Composed runtime verification evidence

Latest whole-app verification succeeded on composition commit `5b3c4f9a5c7396413f04090f31950e8252bb8ae0`.

Successful GitHub Actions runs:

- Mobile Runtime Check: `35341308081`
- Core Check: `35341307918`
- Palta Core CI: `35341307922`

The successful Mobile Runtime Check verified all of the following on the actual composed runtime path:

- launcher shell syntax
- mobile Auth credential boundary
- live `palta-dev` Auth settings endpoint
- required email Auth capability
- source mobile TypeScript
- source Expo config
- source iOS JavaScript bundle
- runtime composition contract
- composition materialization with current live overlays
- rejection of non-runtime `*.template.*` sources from generated runtime
- post-composition Auth credential boundary
- generated simulator runtime TypeScript
- composed iOS simulator JavaScript bundle

The composed check included the current live Negocios, Market and Play surfaces. Their required reviewed Core contracts were reconciled rather than bypassing type safety. In particular, the current food discovery UI now resolves through the reviewed canonical `src/business/foodVertical.ts` contract, while Market lifecycle/message contracts remain explicitly tracked.

An obsolete `supabaseAuthAdapter.template.ts` had initially leaked into generated `apps/mobile/src` and conflicted with the new canonical `AuthSession`. The materializer now removes `*.template.*` source files, and CI explicitly fails if any template source reaches executable generated runtime output.

The composition manifest records Auth/Profile as `integrated` at the reviewed Core SHA. Any later Auth/Profile branch advance must again surface as `CORE REVIEW REQUIRED` until deliberately reconciled.

## Development verification evidence UI

When `EXPO_PUBLIC_ENV=development`, a signed-in user sees a small Gate 01 verification panel containing:

- canonical `Palta ID`
- Supabase `Auth ID`
- session expiry when available

The values are selectable so the same identity can be compared before/after relaunch and after logout/re-login.

The panel does **not** display access tokens, refresh tokens, passwords, or admin credentials and is not shown in preview/production environments.

## Configuration and credential hardening

The mobile Auth adapter is fail-closed:

- no Supabase URL fallback exists in mobile source
- no concrete publishable-key fallback exists in mobile source
- missing URL/key produces a visible `configuration_error`
- Supabase URL must match `https://<project>.supabase.co`
- mobile key must use the `sb_publishable_` format

The repository enforces these boundaries:

1. environment preflight rejects privileged-looking `EXPO_PUBLIC_*` variables, including password/secret/token material
2. mobile Auth secret scanning rejects admin/service-role material, hardcoded Supabase environment binding, public credential variables, Golden User password shortcuts, and password-based Supabase login inside the runtime surface
3. the same Auth secret scan runs again after runtime composition, so an unsafe live overlay cannot silently enter generated `apps/mobile/src`
4. generated runtime must contain no `*.template.*` source files

A previously introduced development password shortcut was removed. Gate 01 must use the real configured user-facing Auth path, not `signInWithPassword` hidden behind a development control.

## Canonical account bootstrap — `palta-dev`

A successful new `auth.users` row is handled by an internal database trigger:

- function: `palta_private.bootstrap_palta_account()`
- `SECURITY DEFINER`
- fixed `search_path`
- unintended public/anon/authenticated EXECUTE revoked
- trigger: `palta_account_bootstrap` after INSERT on `auth.users`
- operation: INSERT `public.palta_account(user_id)` with `ON CONFLICT (user_id) DO NOTHING`

The client does not create Palta accounts and authenticated INSERT privilege was not opened.

The repository migration remains replay-safe:

- real Supabase: trigger/backfill executes when `auth.users` exists
- generic PostgreSQL CI: Supabase-only trigger section skips when `auth.users` is absent

## Verified `palta-dev` invariants — 2026-09-18

Direct database verification confirmed:

- `auth.users` exists
- `palta_account_bootstrap` trigger is enabled
- bootstrap function is SECURITY DEFINER with fixed search path
- `public.palta_account` RLS is enabled
- authenticated SELECT is owner-scoped
- authenticated INSERT remains denied
- authenticated DELETE remains denied
- auth users missing a Palta account = 0 at verification time
- duplicate `palta_account.user_id` groups = 0

A transaction + rollback synthetic two-user test was executed against the real `palta-dev` database:

1. synthetic auth users A/B were inserted inside one transaction
2. trigger produced distinct `palta_account` rows
3. under `SET LOCAL ROLE authenticated` with JWT `sub = A`, A saw its own row
4. A saw zero rows belonging to B
5. the transaction was rolled back
6. follow-up verification confirmed no fixture residue

This verifies server bootstrap and the negative owner-RLS boundary. It does not substitute for mobile provider E2E.

## Optional server fixture provisioning

`apps/mobile/scripts/provision-golden-user.mjs` is trusted developer/admin tooling for preparing a synthetic server fixture. Real fixture credentials belong only in ignored local configuration and must never become mobile public configuration.

The utility may use privileged credentials and a synthetic fixture password **only outside the mobile runtime**. Mobile source cannot consume those values, and CI guards against introducing such a path.

Provisioning a fixture is not Gate 01 completion evidence and does not permit Gate 02 to begin.

## Definition of Done status

| # | Gate 01 requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 1 | Fresh install/no session opens Auth | `NOT VERIFIED` | composed runtime/bundle verified; execute on simulator/device |
| 2 | Golden User login works against `palta-dev` | `NOT VERIFIED` | live mobile email/provider cycle not yet executed |
| 3 | Successful Auth resolves exactly one canonical Palta account | `PARTIALLY VERIFIED` | real trigger/idempotency + composed resolver path verified; provider-driven login still needs E2E |
| 4 | Kill/relaunch restores same session/account | `NOT VERIFIED` | SecureStore/persistSession implemented; device relaunch not executed |
| 5 | Sign out clears local session and returns to Auth | `NOT VERIFIED` | composed runtime path implemented; device interaction not executed |
| 6 | Sign in again resolves same account | `NOT VERIFIED` | requires live mobile cycle |
| 7 | User A cannot read user B account | `VERIFIED` | real `palta-dev` two-user RLS negative test |
| 8 | Missing/invalid config and account failures are visible/safe | `PARTIALLY VERIFIED` | fail-closed/error UI + source/composed typechecks; live failure interaction not executed |
| 9 | No private/admin/password credential bundled in mobile | `VERIFIED` | pre/post-composition credential guards passed |
| 10 | Applicable TypeScript/tests/migrations pass | `VERIFIED` | latest Core Check, full Core CI, source/generated runtime typechecks and composed iOS bundle passed at `5b3c4f9...` |
| 11 | Gate status changes only with real runtime evidence | `VERIFIED` | remains `RUNTIME_CONNECTED` |

## Remaining Gate 01 execution

Do not build Gate 02 yet.

On the development Mac, use the whole-app composition branch:

```bash
git fetch origin
git switch integration/runtime-composition-v1
git pull --ff-only
npm run dev:ios
```

Then:

1. confirm the signed-out Auth surface
2. complete an actually enabled Golden User login path against `palta-dev`; email passwordless is currently available
3. record the displayed `Palta ID` / `Auth ID`
4. confirm the canonical account is exactly one row
5. terminate and relaunch the app; confirm the same identity/session
6. logout; confirm the Auth surface
7. login again; confirm the same `Palta ID`
8. when Apple/Google provider credentials are enabled, smoke-test them and confirm no unintended duplicate account
9. record exact runtime evidence here
10. change Gate 01 to `E2E_VERIFIED` only when the Definition of Done is satisfied

If a live provider fails, record the exact provider/configuration/deep-link failure and fix that blocker only. Do not advance to later product domains from this work package.
