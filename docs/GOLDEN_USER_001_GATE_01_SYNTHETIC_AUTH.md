# Golden User 001 — Gate 01A Synthetic Auth

Status: `RUNTIME_CONNECTED` — development runtime path and CI are verified; trusted Auth Admin provisioning plus device restart-cycle evidence remain `NOT VERIFIED`.

Focused implementation branch: `integration/golden-user-001-auth-synthetic-v1`.

## Why this path exists

Golden User 001 must be able to exercise the real Palta account/session/RLS/runtime path without waiting for Apple/Google provider setup or repeatedly opening an email magic link.

This is not a mock session. The development login must create a real Supabase Auth session and then pass through the same canonical Palta account resolver, owner RLS, SecureStore persistence, logout, and restore path as normal authentication.

## Gate split

- **Gate 01A — Synthetic Auth E2E**: fixed synthetic development user signs in through real Supabase password Auth. Passing 01A allows Golden User 001 to continue to Gate 02.
- **Gate 01B — Real Provider Smoke**: Apple, Google, and production email/deep-link paths are verified separately before release. 01B does not block product-domain Golden User progression after 01A is E2E verified.

## Implemented mobile path

On `integration/golden-user-001-auth-synthetic-v1`:

- `createSupabaseAuthPort.native.ts` exposes a development-only Golden User login action.
- It calls `supabase.auth.signInWithPassword`, so the returned session/JWT is real Supabase Auth state.
- The existing `SupabaseAuthAdapter` still resolves the canonical `PaltaUserId` by checking `public.palta_account` under owner RLS.
- Existing SecureStore session persistence and Auth state subscription are reused.
- `AuthGate` exposes `Golden User 001로 테스트 로그인` only when development configuration explicitly enables it.
- Signed-in development builds continue to show Gate 01 identity evidence (`Palta ID`, `Auth ID`).
- `scripts/preflight-env.mjs` rejects Golden User Auth outside `EXPO_PUBLIC_ENV=development` and rejects production builds carrying Golden User public credentials.
- `scripts/run-ios-mobile.sh` runs the environment boundary preflight before the iOS development launch.

## Production guard

Synthetic login is unavailable unless all conditions are true:

- `EXPO_PUBLIC_ENABLE_GOLDEN_USER_AUTH=true`
- `EXPO_PUBLIC_ENV=development`
- synthetic email and password are supplied to the local development build

No Supabase secret/service-role key is accepted by mobile code.

## Server provisioning

`apps/mobile/scripts/provision-golden-user.mjs` is the trusted-server provisioning command.

It requires server-only environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (`sb_secret_...`)
- `GOLDEN_USER_EMAIL`
- `GOLDEN_USER_PASSWORD`

It uses the Supabase Auth Admin API to create or update the synthetic user, confirms the email, resets the synthetic password idempotently, and writes only non-sensitive authorization metadata:

- `synthetic=true`
- `persona_id=golden-user-001`
- `environment=development`

The secret key and password are never printed.

Do not replace this with direct SQL insertion into `auth.users`.

## Local development configuration

The committed `.env.example` keeps synthetic Auth disabled and contains no synthetic password.

A local ignored env may set:

```text
EXPO_PUBLIC_ENABLE_GOLDEN_USER_AUTH=true
EXPO_PUBLIC_GOLDEN_USER_EMAIL=<same synthetic email provisioned on server>
EXPO_PUBLIC_GOLDEN_USER_PASSWORD=<synthetic development password>
```

These values are for development builds only. The synthetic password is treated as a test credential, never a production credential.

## Verified evidence — 2026-09-18

Current focused-branch HEAD verified at this checkpoint:

`862eb72edd214feac33b122df71acad1b9c2b22f`

Successful GitHub Actions on that exact HEAD:

- Palta Core Check run `35338388785` — `success`
- Palta Core CI run `35338388843` — `success`
- Palta Mobile Runtime Shell run `35338388900` — `success`

The focused branch is used because parallel work sessions were writing contradictory Auth changes to the controller branch. Do not force-update either branch over newer work. Reconcile only after Gate 01A evidence is complete.

Latest direct `palta-dev` database check at this checkpoint:

- `auth.users = 0`
- `auth.identities = 0`
- `public.palta_account = 0`

Therefore no login-capable Golden User has yet been provisioned.

## Current external boundary

The connected Supabase management surface used in this session exposes SQL/project/runtime operations but does not expose Auth Admin user creation or a retrievable secret key. That boundary is intentional and must not be bypassed by inserting directly into Supabase Auth tables or by exposing an admin key to mobile.

The remaining trusted action is therefore to execute the already-versioned `golden:provision` command from a trusted development/server shell that has the project's Supabase secret key. After that one action, the mobile Golden User flow can be exercised without Apple/Google provider interaction.

## Gate 01A Definition of Done

All items must be evidenced before changing 01A to `E2E_VERIFIED`:

1. Golden User is provisioned through Supabase Auth Admin API in `palta-dev`.
2. Exactly one matching `auth.users` row exists.
3. Exactly one matching `public.palta_account` row exists through the server bootstrap trigger.
4. Development Auth screen shows the Golden User test button.
5. Button login succeeds and exposes one canonical `PaltaUserId`.
6. App terminate/relaunch restores the same session and `PaltaUserId`.
7. Logout returns to signed-out Auth.
8. Golden User login again returns the same `PaltaUserId`.
9. Owner RLS still prevents access to another account.
10. Mobile typecheck/CI and secret-boundary checks pass.

Current status by item:

- #1–#3: `NOT VERIFIED` — trusted Auth Admin provisioning has not executed
- #4–#8: `NOT VERIFIED` — requires provisioned synthetic account and actual mobile interaction
- #9: `VERIFIED` on the existing real `palta-dev` negative owner-RLS test
- #10: `VERIFIED` on focused HEAD `862eb72...`

Until #1–#8 are evidenced, Gate 01A remains `RUNTIME_CONNECTED`, not `E2E_VERIFIED`.
