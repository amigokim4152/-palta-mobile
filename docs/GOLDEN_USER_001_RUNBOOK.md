# Golden User 001 — Runtime Verification Runbook

Status: ACTIVE
Golden User branch: `integration/golden-user-001-v1`
Whole-app runtime branch: `integration/runtime-composition-v1`
Base: `integration/repository-normalization-v1`

## Purpose

This is the executable completion path for Somos Palta. A feature is complete only when Golden User 001 can use it in the mobile runtime and the required canonical persistence, permissions, and re-entry checks have been proven.

Feature/Core branches remain Sources of Truth for their own contracts. Actual whole-app simulator verification is executed from `integration/runtime-composition-v1`; do not judge the complete app by checking out a single feature branch.

For Gate 01 Auth specifically, use the dedicated Auth-isolated test mode on the same runtime branch so unrelated live Market/Play/other feature drift cannot invalidate an Auth/session test. This isolation excludes feature overlays only; it does **not** fake Auth, session persistence, deep links, or canonical account resolution.

## Completion states

Every gate uses exactly one of these states:

- `DOCUMENTED` — product/architecture intent exists only
- `CORE_CODE` — provider-neutral/core implementation exists but is not proven in the mobile runtime
- `RUNTIME_CONNECTED` — runtime adapter/provider is connected, but the complete user flow is not yet proven
- `USER_FLOW_WORKING` — the user can complete the interaction in the app
- `E2E_VERIFIED` — interaction, canonical persistence, restart/session restoration, permissions, and downstream linkage are verified
- `BLOCKED` — the next Golden User action cannot proceed because of a known unresolved blocker

Only `E2E_VERIFIED` advances Golden User 001 to the next gate.

## Golden User 001

Golden User 001 is a synthetic development identity. It must never use a real citizen's RUT, phone number, private address, health record, or unrelated third-party identity as fixture data.

Stable test namespace:

- persona id: `golden-user-001`
- fixture marker: `synthetic=true`
- environment: development/test only

A server-side synthetic fixture may be provisioned for deterministic database tests, but it is not a mobile login bypass and does not replace live Auth-provider evidence.

## Gate order

| Gate | User action | Current state | Advance condition |
|---|---|---|---|
| 01 Auth | Open app, create/sign in, leave app, return, sign out/in | `RUNTIME_CONNECTED` | Configured user Auth path works and the same Palta identity/session is restored under owner RLS |
| 02 Core profile | Set minimum profile/locale/timezone | `NOT_STARTED` | Save, restart, restore, edit |
| 03 Location context | Set/deny current location and set home comuna separately | `NOT_STARTED` | Current vs home location remain distinct and persist |
| 04 Home | Enter Home as new/minimal user | `NOT_STARTED` | Correct sparse Home, no filler, correct private cards |
| 05 Household/family | Add permitted household relationships | `NOT_STARTED` | Relationship persists and permission boundaries hold |
| 06 School/community | Join/access allowed school/community scope | `NOT_STARTED` | Membership/access survives restart and revoked membership is denied |
| 07 Pets | Add/edit/remove a synthetic pet | `NOT_STARTED` | Canonical pet relationship + lifecycle/Home/Event linkage works |
| 08 Vehicle | Add/edit/remove a synthetic vehicle | `NOT_STARTED` | Canonical relationship and relevant events work |
| 09 Municipal | Resolve home-comuna benefits/services | `NOT_STARTED` | Correct comuna/eligibility/status reaches Home/action |
| 10 Local Business | Discover/save/regular/contact/quote/reserve | `NOT_STARTED` | Discover → act → status → Home/follow-up works |
| 11 Business owner/staff | Golden User owns/manages a business | `NOT_STARTED` | Owner/staff roles and money-sensitive permissions are enforced |
| 12 Commerce/POS | Sale/payment/fiscal/printing path | `NOT_STARTED` | Canonical transaction and recovery/status path works |
| 13 Messaging/delivery | Receive business/customer status via allowed channel | `NOT_STARTED` | App/WhatsApp handoff and delivery state do not leak private data |
| 14 Transport/map | Use map/journey context | `NOT_STARTED` | Native MapLibre + production data endpoints work |
| 15 Care/Event/follow-up | Wait/deadline/result/follow-up | `NOT_STARTED` | Event returns to correct Home/action state |

## Gate 01 current state — 2026-09-18

Gate 01 is `RUNTIME_CONNECTED`. The runtime/server/test harness are ready, but the complete real mobile login → terminate/relaunch → logout → login-again cycle has not yet been executed and recorded.

Verified implementation/data facts:

1. `integration/auth-profile-core-v1` is the Auth/Profile Core Source of Truth; normalized canonical account resolution is reconciled there
2. whole-app Auth execution is integrated into `integration/runtime-composition-v1`; `apps/mobile/src` remains generated output
3. Auth UI is capability-aware and only shows methods enabled by live Supabase settings
4. `palta-dev` public Auth settings are reachable; email is enabled while Apple and Google are currently disabled
5. Supabase provider code remains behind the existing Auth adapter/provider boundary
6. raw provider identity, `AuthBrokerUserId`, and canonical `PaltaUserId` remain separate concepts
7. session persistence uses Expo SecureStore; OAuth/email callback processing uses PKCE
8. duplicate PKCE callback exchange is guarded
9. Auth/account-resolution failures are shown as errors rather than disguised as signed-out state
10. `palta-dev` has server-owned canonical `palta_account` bootstrap from `auth.users`
11. client INSERT on `palta_account` remains denied
12. a real `palta-dev` two-user transaction/RLS test proved user A cannot read user B account
13. mobile config accepts only a publishable Supabase key and contains no service-role/admin credential
14. CI rejects public password/secret/token material and password-based Golden User bypasses
15. development builds show canonical account resolution state, `Palta ID`, and `Auth ID` after sign-in
16. `scheme=palta` and app identifiers remain `cl.somospalta.app`
17. historical whole-app composition verification succeeded at `5b3c4f9a5c7396413f04090f31950e8252bb8ae0` in Mobile Runtime Check `35341308081`
18. Auth/Profile integration is recorded in the composition manifest at source SHA `a030511374d7a7a4b1383d5627f7d9ba4e6780aa`
19. `npm run test:golden:ios` starts a development-only Gate 01 Auth-isolated runtime from `integration/runtime-composition-v1`
20. the launcher asks locally for a Golden User test email and uses the real `palta-dev` email Magic Link flow
21. Gate 01 isolation uses `mobile-overlay/src` → existing `apps/mobile/src`; it does not compose unrelated live feature overlays
22. dedicated `Golden User Gate 01 Auth Test Check` run `35345553869` passed launcher validation, real `palta-dev` readiness, source/generated typechecks, source/generated iOS bundles, template rejection, and pre/post materialization Auth credential checks

## Gate 01 test-mode boundary

The dedicated test mode exists only to keep Auth verification deterministic while other product surfaces are changing in parallel.

It **does test**:

- actual Supabase email Magic Link
- actual `palta://auth/callback` path
- actual canonical account resolver
- actual `palta_account` bootstrap/RLS boundary
- actual persisted mobile session
- actual logout/re-login path

It **does not test or include** unrelated live Market/Play/Negocios surface overlays during this Gate 01 run.

It is therefore valid evidence for Gate 01 Auth/session/account behavior, but not proof that every current product surface composes successfully at the same instant.

### Optional server fixture utility

`apps/mobile/scripts/provision-golden-user.mjs` and `apps/mobile/.env.golden.example` are server/developer-side fixture tooling only. Real values live in ignored local configuration and are never mobile public configuration.

This utility can prepare deterministic server/account fixtures. It does not create a mobile password bypass, does not count as Auth E2E evidence, and does not unlock Gate 02.

See `docs/GOLDEN_USER_001_GATE_01_SYNTHETIC_AUTH.md` for the server-fixture boundary.

## Gate 01 executable sequence

On the development Mac:

```bash
git fetch origin
git switch integration/runtime-composition-v1
git pull --ff-only
npm run test:golden:ios
```

The terminal prompts:

```text
Golden User 001 테스트 이메일:
```

Enter the email to use for the synthetic Golden User test identity. It is supplied to the local development process and is not committed to Git.

Then execute in order:

1. verify the signed-out Auth surface and `Golden User 001 테스트` panel appear
2. tap `테스트 로그인 링크 보내기`
3. receive the real `palta-dev` email Magic Link
4. open it through the simulator callback, or paste it into `받은 Magic Link 붙여넣기` and trigger the login test
5. record the displayed canonical `Palta ID` and `Auth ID`
6. confirm exactly one matching canonical `public.palta_account` exists
7. terminate the app completely
8. relaunch the Gate 01 test runtime and confirm the same restored session and `Palta ID`
9. sign out and confirm return to Auth
10. sign in again and confirm the same `Palta ID`
11. record exact evidence in `docs/GOLDEN_USER_001_GATE_01_AUTH_HANDOFF.md`
12. change Gate 01 to `E2E_VERIFIED` only after all required evidence exists

Apple/Google are not part of this immediate execution because those providers are currently disabled in `palta-dev`. When their credentials are enabled, exercise them and confirm no unintended duplicate canonical Palta account is created.

If a provider/configuration/deep-link error occurs, stop at that exact failure and fix only that Gate 01 blocker.

## Database hardening scope note

Existing Supabase advisor findings around PostGIS/public schema and Local Business intake are separate platform/data hardening work. Do not alter PostGIS or unrelated domain schemas while Gate 01 is being verified.

## Gate discipline

When a gate blocks:

1. stop Golden User progression
2. record the exact break
3. fix only the blocker and its integration boundary
4. verify on development runtime/data
5. mark `E2E_VERIFIED` only with evidence
6. continue to the next gate

Do not jump ahead to Gate 02, Pets, POS, Community, or visual polish while Gate 01 remains below `E2E_VERIFIED`.
