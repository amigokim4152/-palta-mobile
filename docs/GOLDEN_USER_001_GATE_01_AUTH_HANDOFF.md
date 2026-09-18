# Golden User 001 — Gate 01 Auth Runtime Handoff

Status: BLOCKED — implementation required before Golden User can proceed.

## Source of truth

Use these together; do not recreate them independently:

1. `integration/repository-normalization-v1` — current normalized repository baseline.
2. `integration/golden-user-001-v1` — Golden User controller/runbook branch.
3. `integration/auth-profile-core-v1` — earlier Auth/Profile implementation that contains account/identity/session/resolver code missing from the normalized branch. Reconcile; do not blindly duplicate.
4. `integration/mobile-runtime-shell-v1` — mobile runtime/package reference, including Expo SecureStore support.
5. Supabase project `palta-dev` (`rqbpbauhkdgsrkbwmkmg`) — actual development Auth/Postgres target.

Do not create a replacement repository, replacement Supabase project, or competing Auth model.

## Verified repository gap

At the time of this handoff:

- `integration/repository-normalization-v1/src/auth` contains only `authCoordinator.ts`.
- `integration/auth-profile-core-v1/src/auth` additionally contains `accountModel.ts`, `accountResolver.ts`, `identityModel.ts`, `providerPrincipal.ts`, and `sessionPolicy.ts`.
- The normalized mobile route tree has no dedicated Auth route.
- Root mobile layout wires SQLite/mutation/neighborhood providers, not Auth/session state.
- `.env.example` has placeholders for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `integration/mobile-runtime-shell-v1` includes `expo-secure-store` in the intended Expo runtime package.

## Verified development database state

Project: `palta-dev`
Region: `sa-east-1`
Status at check: ACTIVE_HEALTHY

`public.palta_account` exists with:

- `user_id uuid` primary key
- FK `user_id -> auth.users(id) ON DELETE CASCADE`
- `status text`
- `display_name text nullable`
- `preferred_locale text`
- timestamps

RLS is enabled.

Current policies:

- authenticated owner SELECT using `auth.uid() = user_id`
- authenticated owner UPDATE policy exists

Current effective table privileges:

- authenticated: SELECT = true, INSERT/UPDATE/DELETE = false
- service_role: SELECT/INSERT/UPDATE/DELETE = false at the time checked

There is no trigger on `auth.users` or `public.palta_account` creating the Palta account row.

Therefore a successful Supabase Auth user currently has no proven automatic path to a canonical `palta_account` row. The UPDATE RLS policy is not sufficient because the authenticated role currently lacks UPDATE table privilege.

`palta_account` contained zero rows at the time of the check.

## Current Supabase implementation requirements

Follow current Supabase guidance, not stale examples.

- Use a publishable client key, never a service-role/secret key in Expo.
- Persist the session securely on mobile.
- Keep authorization data out of user-editable user metadata.
- RLS and table grants are separate; both must be correct.
- Do not use `TO authenticated` without an ownership predicate for private rows.
- UPDATE policies need both `USING` and `WITH CHECK`.
- If a SECURITY DEFINER bootstrap function is used, keep it out of exposed/public API surface where practical, fix `search_path`, revoke unintended EXECUTE grants, and verify with security advisors.
- New Data API exposure/grants must be explicit under current Supabase defaults.

## Product authentication direction

The existing product direction is:

- Sign in with Apple
- Continue with Google
- Continue with email passwordless (Magic Link or OTP; choose one coherent production path and implement its recovery/re-entry behavior)

Provider identities are login mechanisms. The Palta account is the stable application identity. Multiple provider identities must not silently create duplicate Palta people.

## Required user-touchable surface

The first usable screen may be visually basic. It must include the actions the user actually needs:

- startup/session restoration state
- Apple button
- Google button
- email button/input flow
- loading/progress state
- actionable configuration/provider error
- retry
- sign out
- expired/invalid session recovery
- return to the intended app route after successful sign-in

Do not enter Home silently when auth/configuration fails.

## Required implementation boundary

Implement provider-specific Supabase code behind an Auth adapter/provider boundary. Domain/core code must not be coupled to Supabase-specific session objects.

Reconcile the existing Auth/Profile Core code from `integration/auth-profile-core-v1` with the normalized branch rather than writing a second account model.

The mobile Source of Truth remains `mobile-overlay/src`; generated runtime source must not be edited as a second UI source of truth.

## Account bootstrap decision required in implementation

A new authenticated user must resolve to exactly one `public.palta_account` row.

Choose and implement one auditable bootstrap path consistent with Palta's server/client boundary. Candidate patterns include:

- an internal, tightly scoped auth-user-created database trigger; or
- an authenticated/server-side Palta bootstrap endpoint.

Do not grant broad client INSERT access merely to make onboarding work.

Whichever pattern is selected must be tested for:

- first login creates/resolves account
- second login resolves same account
- linked identity does not create a second account
- logout/restart/session restoration
- user A cannot read user B account
- app client cannot use server/admin credentials

## Definition of Done for Gate 01

Do not report completion until all are verified:

1. Fresh install opens auth surface when no valid session exists.
2. At least the selected Golden User login path works against `palta-dev`.
3. Successful auth resolves exactly one canonical Palta account.
4. Kill/relaunch restores the same session/account.
5. Sign out removes the local session and returns to auth.
6. Sign in again resolves the same account.
7. Owner RLS is verified with two synthetic users or an equivalent negative test.
8. Missing/invalid configuration fails visibly and safely.
9. No private/admin key is bundled in mobile code.
10. Applicable TypeScript/tests pass; anything not runnable is explicitly `NOT VERIFIED`.
11. Golden User runbook is updated from `BLOCKED` to `E2E_VERIFIED` only after runtime evidence exists.

After Gate 01 reaches `E2E_VERIFIED`, return to `docs/GOLDEN_USER_001_RUNBOOK.md` and begin Gate 02 Core Profile. Do not expand scope into later domains from this Auth work package.
