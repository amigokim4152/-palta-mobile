# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: `RUNTIME_CONNECTED` — Auth/Profile Core, mobile Auth runtime, canonical account bootstrap, RLS boundary, public configuration validation, Gate 01 isolated simulator runtime typecheck, and iOS bundle are connected and verified. The complete live mobile/provider cycle is still `NOT VERIFIED`.

Gate 01 must **not** be changed to `E2E_VERIFIED` until the actual mobile login → terminate/relaunch → logout → login-again cycle is executed against `palta-dev` and resolves to the same canonical Palta account.

There is no Gate 01A/01B shortcut. A server-side synthetic fixture or a successful bundle does not allow progression to Gate 02.

## Source of truth

Use these together; do not create a competing Auth model:

1. `integration/golden-user-001-v1` — Golden User orchestration/evidence branch
2. `integration/runtime-composition-v1` — whole-app iOS runtime/simulator Source of Truth and Gate 01 test launcher
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

The Auth/Profile Core exposes a small canonical runtime contract for broker-id normalization and canonical account verification. The mobile adapter uses that contract instead of copying the full persistence/profile model or creating a second Auth model.

Auth state subscriptions have separate state/error channels. A provider session that cannot resolve its canonical Palta account is surfaced to the runtime error UI instead of being disguised as `signed_out`.

## Implemented mobile Auth runtime

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
- signed-in app gate around the existing mobile shell

At the latest verified `palta-dev` public provider state:

- Email Auth: enabled
- Apple Auth: disabled pending real provider credentials
- Google Auth: disabled pending real provider credentials

Disabled providers are not shown as dead buttons. When their Supabase provider configuration is enabled, the runtime can expose them without a new account model.

## Whole-app composition verification history

A complete whole-app verification previously succeeded on composition commit `5b3c4f9a5c7396413f04090f31950e8252bb8ae0`.

Successful GitHub Actions runs for that composition:

- Mobile Runtime Check: `35341308081`
- Core Check: `35341307918`
- Palta Core CI: `35341307922`

That successful Mobile Runtime Check verified launcher syntax, mobile Auth credential boundaries, live `palta-dev` settings, source/generated TypeScript, source/composed iOS bundles, composition materialization, and template-source rejection.

Later live Market/Play work can advance independently and may temporarily break full composition before their contracts are reconciled. Gate 01 Auth verification must not silently inherit those unrelated feature failures.

## Gate 01 isolated test runtime — verified 2026-09-18

A dedicated development-only Gate 01 test mode is now available on `integration/runtime-composition-v1`.

It deliberately tests the real Auth/session/account boundary while excluding unrelated live feature overlays:

- launcher: `npm run test:golden:ios`
- runtime mode: `PALTA_RUNTIME_MODE=gate01_auth`
- source: versioned `mobile-overlay/src`
- generated target: existing `apps/mobile/src`
- Auth backend: real `palta-dev`
- login path: real Supabase email Magic Link
- account resolution: real canonical `public.palta_account`
- session persistence: real SecureStore/Supabase persisted session
- no password shortcut
- no service-role/admin key in the mobile runtime

The terminal asks locally for the Golden User test email when the command is run without an argument. The email is passed to the development process only and is not written to the repository.

The development Auth screen exposes a `Golden User 001 테스트` panel when a test email is present. It can:

1. send the real `palta-dev` Magic Link
2. accept a received Supabase Magic Link pasted into the simulator
3. open that link through the real mobile callback path
4. show the resulting canonical `Palta ID` and Supabase `Auth ID`

Dedicated GitHub Actions workflow `Golden User Gate 01 Auth Test Check` run `35345553869` completed successfully for runtime-composition commit `9c112df522846d70dc9f950342dd212f1619536b`.

That isolated test-path CI verified:

- Gate 01 launcher shell syntax and isolation marker
- mobile Auth credential boundary
- live `palta-dev` public Auth settings
- Email Auth enabled
- source mobile TypeScript
- source iOS JavaScript bundle
- isolated `mobile-overlay/src` → `apps/mobile/src` materialization
- no executable `*.template.*` source leakage
- post-materialization Auth credential boundary
- isolated simulator runtime TypeScript
- isolated simulator iOS JavaScript bundle

This makes Gate 01 **ready for a real user-driven simulator test**. It is not itself the final E2E evidence because GitHub CI cannot click the email link, terminate the iOS app, relaunch it, and perform the logout/re-login cycle as the Golden User.

## Development verification evidence UI

When `EXPO_PUBLIC_ENV=development`, a signed-in user sees a small Gate 01 verification panel containing:

- canonical account resolution status
- canonical `Palta ID`
- Supabase `Auth ID`
- session expiry when available

The values are selectable so the same identity can be compared before/after relaunch and after logout/re-login.

The panel does **not** display access tokens, refresh tokens, passwords, or admin credentials and is not shown in preview/production environments.

## Configuration and credential hardening

The mobile Auth adapter is fail-closed:

- no private/admin key is accepted as mobile configuration
- missing URL/key produces a visible `configuration_error`
- Supabase URL must match `https://<project>.supabase.co`
- mobile key must use the `sb_publishable_` format

The repository enforces these boundaries:

1. environment preflight rejects privileged-looking `EXPO_PUBLIC_*` variables, including password/secret/token material
2. mobile Auth secret scanning rejects admin/service-role material, Golden User password shortcuts, and password-based Supabase login inside the runtime surface
3. Auth secret scanning runs after runtime materialization
4. generated runtime must contain no `*.template.*` source files

A previously introduced development password shortcut was removed. Gate 01 uses the real configured user-facing Auth path.

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

## Definition of Done status

| # | Gate 01 requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 1 | Fresh install/no session opens Auth | `NOT VERIFIED` | isolated runtime builds successfully; execute on simulator/device |
| 2 | Golden User login works against `palta-dev` | `NOT VERIFIED` | real Magic Link test harness is ready; human email-link interaction still required |
| 3 | Successful Auth resolves exactly one canonical Palta account | `PARTIALLY VERIFIED` | real trigger/idempotency + resolver path verified; provider-driven login still needs E2E |
| 4 | Kill/relaunch restores same session/account | `NOT VERIFIED` | SecureStore/persistSession implemented; device relaunch not executed |
| 5 | Sign out clears local session and returns to Auth | `NOT VERIFIED` | runtime path implemented; device interaction not executed |
| 6 | Sign in again resolves same account | `NOT VERIFIED` | requires live mobile cycle |
| 7 | User A cannot read user B account | `VERIFIED` | real `palta-dev` two-user RLS negative test |
| 8 | Missing/invalid config and account failures are visible/safe | `PARTIALLY VERIFIED` | fail-closed/error UI + isolated source/generated typechecks; live failure interaction not executed |
| 9 | No private/admin/password credential bundled in mobile | `VERIFIED` | isolated pre/post-materialization credential guards passed |
| 10 | Applicable TypeScript/tests/migrations pass | `VERIFIED` | Gate 01 isolated source/generated typechecks and iOS bundles passed in run `35345553869` |
| 11 | Gate status changes only with real runtime evidence | `VERIFIED` | remains `RUNTIME_CONNECTED` |

## Remaining Gate 01 execution

Do not build Gate 02 yet.

On the development Mac:

```bash
git fetch origin
git switch integration/runtime-composition-v1
git pull --ff-only
npm run test:golden:ios
```

The terminal will ask:

```text
Golden User 001 테스트 이메일:
```

Enter the email address you want to use as the synthetic Golden User test identity. The value stays in the local development process.

Then execute in order:

1. confirm the signed-out Auth surface and `Golden User 001 테스트` panel
2. tap `테스트 로그인 링크 보내기`
3. receive the real `palta-dev` Magic Link
4. open it on the same simulator path, or paste it into `받은 Magic Link 붙여넣기` and tap the test-login button
5. record displayed `Palta ID` and `Auth ID`
6. confirm the canonical account is exactly one row
7. terminate the app completely
8. relaunch the same Gate 01 test command/runtime and confirm the same session and `Palta ID`
9. logout and confirm return to Auth
10. login again and confirm the same `Palta ID`
11. record exact runtime evidence here
12. change Gate 01 to `E2E_VERIFIED` only after all required evidence exists

Apple/Google remain out of this immediate Gate 01 test because they are disabled in the current `palta-dev` provider configuration. When provider credentials are enabled, smoke-test them separately and confirm no unintended duplicate Palta account.

If a live provider fails, record the exact provider/configuration/deep-link failure and fix that blocker only. Do not advance to later product domains from this work package.
