# Golden User 001 — Server Fixture Provisioning

Status: `UTILITY_ONLY` — this document describes optional server-side provisioning for a synthetic development identity. It is **not** a mobile Auth bypass, does **not** split Gate 01, and does **not** allow progression to Gate 02.

## Gate 01 remains unchanged

Golden User Gate 01 is governed by:

- `docs/GOLDEN_USER_001_RUNBOOK.md`
- `docs/GOLDEN_USER_001_GATE_01_AUTH_HANDOFF.md`

Gate 01 becomes `E2E_VERIFIED` only after the real mobile runtime completes the configured Auth flow against `palta-dev`, restores the same canonical account after app termination/relaunch, logs out, and signs in again to the same account.

A server-created fixture or password session is not evidence for that requirement.

## Purpose of the fixture utility

`apps/mobile/scripts/provision-golden-user.mjs` is developer/admin tooling for creating or resetting a controlled synthetic Auth user when server/account/RLS tests need a stable fixture.

It is outside the mobile runtime contract. Mobile application code must not import it, invoke it, or receive its admin credentials.

The provisioning command requires server-only environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (`sb_secret_...`)
- `GOLDEN_USER_EMAIL`
- `GOLDEN_USER_PASSWORD`

The committed `apps/mobile/.env.golden.example` contains only placeholders for the secret/password. Real values must remain uncommitted and server/developer-side only.

The provisioning utility may:

1. create or locate the synthetic Supabase Auth user through the Admin API,
2. confirm/reset the synthetic account for controlled test preparation,
3. write non-sensitive fixture metadata such as `synthetic=true`, `persona_id=golden-user-001`, and `environment=development`,
4. rely on the existing server-owned `auth.users` → `public.palta_account` bootstrap trigger.

Do not replace this with direct SQL insertion into `auth.users`.

## Mobile security boundary

The following are prohibited in the mobile runtime, including development builds:

- `SUPABASE_SECRET_KEY`, service-role keys, JWT secrets, or other admin credentials,
- passwords/secrets/tokens carried in `EXPO_PUBLIC_*`,
- `EXPO_PUBLIC_GOLDEN_USER_PASSWORD`,
- a `signInAsGoldenUser` password shortcut,
- `supabase.auth.signInWithPassword(...)` as a hidden Golden User bypass.

`scripts/check-mobile-auth-secrets.mjs` enforces this boundary in CI.

The mobile app uses only the public Supabase URL and publishable key, then follows the configured user-facing provider path through the existing Auth adapter/provider boundary.

## Current provider state

At the latest `palta-dev` public Auth-settings verification:

- Email Auth: enabled and required by CI
- Apple Auth: currently disabled; button stays hidden until the provider is configured
- Google Auth: currently disabled; button stays hidden until the provider is configured

Therefore the presently available live Gate 01 user path is email passwordless Auth. Apple/Google must be smoke-tested after their provider credentials are enabled.

## Development identity evidence

Signed-in development builds display a small Gate 01 evidence panel containing only:

- canonical `Palta ID`
- Supabase `Auth ID`
- session expiry when available

It intentionally does **not** display access tokens, refresh tokens, passwords, or admin material.

Use the displayed `Palta ID` to compare the initial login, app relaunch, logout/login-again cycle. This display makes verification easier; it does not replace the E2E interaction itself.

## What this utility can and cannot prove

Server fixture provisioning can support deterministic database/account tests, but by itself it cannot prove:

- the mobile signed-out screen,
- email/OAuth callback/deep-link behavior,
- SecureStore restoration after process termination,
- mobile logout UX,
- provider-specific identity linking,
- the complete Golden User Gate 01 Definition of Done.

Until the actual runtime evidence exists, Gate 01 remains `RUNTIME_CONNECTED`, not `E2E_VERIFIED`, and Gate 02 remains blocked.
