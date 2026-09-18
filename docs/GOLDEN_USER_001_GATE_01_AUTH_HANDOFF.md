# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: `RUNTIME_CONNECTED`.

Gate 01 is now deliberately split:

- **01A Synthetic Auth E2E** — executable development gate. When this is `E2E_VERIFIED`, Golden User 001 may advance to Gate 02.
- **01B Real Provider Smoke** — Apple / Google / production email and deep-link release verification. It remains mandatory before release, but does not block product-domain Golden User progression after 01A passes.

See `docs/GOLDEN_USER_001_GATE_01_SYNTHETIC_AUTH.md` for the authoritative 01A contract.

## Source of truth

Use together; do not create a competing Auth model:

1. `integration/golden-user-001-v1`
2. `integration/repository-normalization-v1`
3. `integration/auth-profile-core-v1` for already-reconciled identity/account concepts
4. Supabase project `palta-dev` (`rqbpbauhkdgsrkbwmkmg`)

In normalized v1, `public.palta_account.user_id` is the canonical application id and is a foreign key to `auth.users(id)`.

## Verified internal Auth foundation

The following had already been verified before the synthetic-login addition:

- provider SDK details stay behind the mobile Auth adapter
- raw provider identity, `AuthBrokerUserId`, and `PaltaUserId` are separate concepts
- `AuthRuntimeProvider` restores persisted sessions and exposes errors rather than disguising account-resolution failures as signed-out state
- `AuthGate` is the user-touchable login gate
- session persistence uses Expo SecureStore
- OAuth/email callback path uses PKCE with duplicate callback-code protection
- live Supabase capability discovery controls Apple/Google/email button availability
- `palta-dev` has a private server-owned trigger that creates `public.palta_account` after `auth.users` INSERT
- client INSERT into `palta_account` is not opened
- owner RLS was negatively verified with two synthetic users inside a rolled-back transaction
- earlier Core/CI/mobile runtime checks passed on the pre-synthetic baseline

At the current `palta-dev` provider state, email is enabled while Apple and Google are disabled pending real provider credentials.

## Gate 01A Synthetic Auth implementation

Golden User 001 no longer needs Apple/Google or a repeated email-link interaction to exercise Palta's internal life-flow.

Implemented on `integration/golden-user-001-v1`:

- mobile Auth port has a dev-only `signInAsGoldenUser()` action
- the action calls real `supabase.auth.signInWithPassword`
- the resulting real Supabase session still passes through the existing canonical Palta account resolver and owner-RLS lookup
- existing SecureStore persistence, logout, Auth subscriptions and restart restoration path are reused
- `AuthGate` exposes `Golden User 001로 테스트 로그인` only when the development flag and synthetic credentials are explicitly supplied
- production/prod environment disables this path even if the flag is mistakenly enabled
- mobile accepts no Supabase secret/service-role key
- signed-in development UI shows `Palta ID` and `Auth ID` evidence

### Server-only provisioning

`apps/mobile/scripts/provision-golden-user.mjs` creates or updates the fixed synthetic login user using Supabase Auth Admin API.

Required trusted-environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (`sb_secret_...`)
- `GOLDEN_USER_EMAIL`
- `GOLDEN_USER_PASSWORD`

The script:

- looks up the email idempotently
- creates the user if missing
- confirms the email
- sets/resets the synthetic password
- stores `app_metadata` with `synthetic=true`, `persona_id=golden-user-001`, `environment=development`
- never prints the password or secret key

Direct SQL insertion into `auth.users` is not the provisioning path.

A server-only blank example exists at `apps/mobile/.env.golden.example`.

### Mobile development configuration

`.env.example` leaves the synthetic path disabled by default:

```text
EXPO_PUBLIC_ENABLE_GOLDEN_USER_AUTH=false
EXPO_PUBLIC_GOLDEN_USER_EMAIL=
EXPO_PUBLIC_GOLDEN_USER_PASSWORD=
```

A local development env may enable these values after the matching server-side user has been provisioned. They must never be enabled in production.

## Current 01A evidence status

| Requirement | Status |
|---|---|
| Real Supabase Auth adapter/session path | `VERIFIED` on existing baseline |
| `palta_account` server bootstrap | `VERIFIED` |
| owner RLS negative boundary | `VERIFIED` |
| dev-only Golden User button/runtime path implemented | `IMPLEMENTED / CI PENDING` |
| server Auth Admin provisioning command implemented | `IMPLEMENTED / NOT EXECUTED` |
| fixed Golden User exists in `palta-dev` | `NOT VERIFIED` — latest observed Auth user count was 0 |
| Golden User button login | `NOT VERIFIED` |
| terminate/relaunch same session/account | `NOT VERIFIED` |
| logout → login again same `PaltaUserId` | `NOT VERIFIED` |
| final synthetic-login commit CI/typecheck | `PENDING` |

Gate 01A therefore remains `RUNTIME_CONNECTED`, not `E2E_VERIFIED`.

## Exact next execution

Do not start Gate 02 yet.

1. In a trusted server/development shell, provide the secret and synthetic credential env values.
2. Run the mobile package provisioning command `npm run golden:provision`.
3. Confirm one matching `auth.users` row and one `public.palta_account` row in `palta-dev`.
4. Enable the local development `EXPO_PUBLIC_ENABLE_GOLDEN_USER_AUTH=true` plus matching synthetic email/password.
5. Launch the actual generated mobile runtime.
6. Press `Golden User 001로 테스트 로그인`.
7. Record the displayed `Palta ID` and `Auth ID`.
8. Terminate the app and relaunch; confirm the same session/Palta ID.
9. Logout; confirm signed-out Auth.
10. Test-login again; confirm the same Palta ID.
11. Confirm final CI/typecheck/secret-boundary checks.
12. Mark **01A `E2E_VERIFIED`** and then proceed to Gate 02.

## Gate 01B release provider smoke

Before release, separately verify intended providers:

- Apple
- Google
- production email/passwordless
- mobile deep link/callback
- duplicate-account/linking behavior across providers

Do not enable Apple/Google with placeholder credentials merely to satisfy a test status.

## Scope discipline

Existing Supabase advisor findings around PostGIS/public schema and Local Business intake are separate platform/data hardening work. Do not alter PostGIS or unrelated domain schemas as part of Auth Gate 01A.
