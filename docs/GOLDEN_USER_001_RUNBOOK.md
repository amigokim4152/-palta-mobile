# Golden User 001 — Runtime Verification Runbook

Status: ACTIVE
Branch: `integration/golden-user-001-v1`
Base: `integration/repository-normalization-v1`

## Purpose

This is the executable completion path for Somos Palta. A feature is complete only when Golden User 001 can use it in the mobile runtime and the required canonical persistence, permissions, and re-entry checks have been proven.

## Completion states

Every gate uses exactly one of these states:

- `DOCUMENTED` — product/architecture intent exists only
- `CORE_CODE` — provider-neutral/core implementation exists but is not proven in the mobile runtime
- `RUNTIME_CONNECTED` — runtime adapter/provider is connected, but the complete user flow is not yet proven
- `USER_FLOW_WORKING` — the user can complete the interaction in the app
- `E2E_VERIFIED` — interaction, canonical persistence, restart/session restoration, permissions, and downstream linkage are verified
- `BLOCKED` — the next Golden User action cannot proceed because of a known unresolved blocker

Golden User progresses only through an `E2E_VERIFIED` executable gate. External provider release smoke is tracked separately when it does not change the internal Palta life-flow contract.

## Golden User 001

Golden User 001 is a synthetic development identity. It must never use a real citizen's RUT, phone number, private address, health record, or unrelated third-party identity as fixture data.

Stable test namespace:

- persona id: `golden-user-001`
- fixture marker: `synthetic=true`
- environment: development/test only

## Gate order

| Gate | User action | Current state | Advance condition |
|---|---|---|---|
| 01A Synthetic Auth | Open app, test-login, leave app, return, sign out/in | `RUNTIME_CONNECTED` | Same real Supabase session/Palta identity is restored and account row is accessible under owner RLS |
| 01B Real Provider Smoke | Apple / Google / production email/deep link | `RELEASE_PENDING` | Each configured provider resolves correctly without unintended duplicate Palta accounts; does not block Gate 02 after 01A passes |
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

## Gate 01A current state — 2026-09-18

Gate 01A is `RUNTIME_CONNECTED`.

The previous Apple/Google/email runtime and canonical account work remains in place. In addition, Golden User 001 now has a dedicated development-only synthetic login path designed to exercise the real internal Auth path without waiting on external OAuth provider setup.

Implemented facts:

1. mobile UI Source of Truth remains `mobile-overlay/src`; `apps/mobile/src` remains generated
2. normal Auth UI is capability-aware and only shows methods enabled by live Supabase settings
3. `palta-dev` public Auth settings are reachable; email is enabled while Apple/Google are currently disabled
4. Supabase session persistence uses Expo SecureStore and PKCE callback handling
5. raw provider subject, Supabase `AuthBrokerUserId`, and canonical `PaltaUserId` remain explicit separate identity layers
6. `palta-dev` has server-owned canonical `palta_account` bootstrap from `auth.users`
7. client INSERT on `palta_account` remains denied and owner RLS has been negatively verified
8. `createSupabaseAuthPort.native.ts` now exposes a dev-only Golden User action that calls real `supabase.auth.signInWithPassword`
9. that test action still passes through the existing canonical account resolver and `palta_account` owner-RLS lookup
10. `AuthGate` has a user-touchable `Golden User 001로 테스트 로그인` control when explicitly enabled in development
11. production/prod environment suppresses the synthetic login even if the enable flag is accidentally set
12. mobile never receives a Supabase secret/service-role key
13. `apps/mobile/scripts/provision-golden-user.mjs` provisions or updates the fixed synthetic user through server-only Supabase Auth Admin API
14. server provisioning metadata marks the user as synthetic / `golden-user-001` / development
15. direct SQL insertion into `auth.users` is explicitly not used for the login-capable fixture

See `docs/GOLDEN_USER_001_GATE_01_SYNTHETIC_AUTH.md` for the exact 01A contract.

### Gate 01A still NOT VERIFIED

The server-side synthetic user has not yet been provisioned through the Auth Admin API in this verification session because no Supabase secret key is exposed to the mobile/runtime connector. The current real `palta-dev` Auth user count remains zero at the last check.

Therefore the following still require actual evidence:

1. provision Golden User 001 through `npm run golden:provision` in a trusted environment with `SUPABASE_SECRET_KEY`
2. confirm exactly one real `auth.users` row and one triggered `public.palta_account` row
3. enable local development Golden User Auth variables
4. launch mobile runtime and press the Golden User button
5. record the canonical `PaltaUserId`
6. terminate/relaunch and confirm the same session/account
7. logout, sign in again, confirm the same `PaltaUserId`
8. run applicable CI/typechecks and secret-boundary checks on the final commit
9. change 01A to `E2E_VERIFIED` only with this evidence

After **01A** becomes `E2E_VERIFIED`, Golden User 001 may continue immediately to **Gate 02 Core profile**. Gate 01B remains a separate release-readiness obligation.

## Gate 01B release provider smoke

Before production release, configure and test each intended provider:

- Apple
- Google
- production email/passwordless + deep link

The provider smoke must verify that provider identities resolve to intended Palta identities without unintended duplicates. Do not invent placeholder Apple/Google credentials merely to turn buttons on.

## Database hardening scope note

The latest Supabase security-advisor pass contains existing PostGIS/public-schema findings and a Local Business intake finding. They are tracked separately and must not be “fixed” by an untested PostGIS relocation/drop while Golden User Auth is being verified.

## Gate discipline

When an executable gate blocks:

1. stop Golden User progression
2. record the exact break
3. fix only the blocker and its integration boundary
4. verify on development runtime/data
5. mark `E2E_VERIFIED` only with evidence
6. continue to the next gate

Do not jump ahead to Pets, POS, Community, or visual polish while Gate 01A remains below `E2E_VERIFIED`.
