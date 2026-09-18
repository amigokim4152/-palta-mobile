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

Gate 01 is `RUNTIME_CONNECTED`. The runtime and server foundation are connected, but the complete real mobile login → terminate/relaunch → logout → login-again cycle has not yet been executed and recorded.

Verified implementation/data facts:

1. mobile UI Source of Truth remains `mobile-overlay/src`; `apps/mobile/src` is generated
2. Auth UI is capability-aware and only shows methods enabled by live Supabase settings
3. `palta-dev` public Auth settings are reachable; email is enabled while Apple and Google are currently disabled
4. Supabase provider code remains behind the existing Auth adapter/provider boundary
5. raw provider identity, `AuthBrokerUserId`, and canonical `PaltaUserId` remain separate concepts
6. session persistence uses Expo SecureStore; OAuth/email callback processing uses PKCE
7. duplicate PKCE callback exchange is guarded
8. Auth/account-resolution failures are shown as errors rather than disguised as signed-out state
9. `palta-dev` has server-owned canonical `palta_account` bootstrap from `auth.users`
10. client INSERT on `palta_account` remains denied
11. a real `palta-dev` two-user transaction/RLS test proved user A cannot read user B account
12. mobile config is fail-closed and accepts only a Supabase publishable key
13. mobile runtime contains no service-role/admin key, public password, or Golden User password shortcut
14. CI rejects `EXPO_PUBLIC_*` password/secret/token material and password-based Golden User bypasses
15. development builds show `Palta ID` and `Auth ID` after sign-in so the same identity can be compared across restart and re-login
16. `scheme=palta` and app identifiers remain `cl.somospalta.app`

### Optional server fixture utility

`apps/mobile/scripts/provision-golden-user.mjs` and `apps/mobile/.env.golden.example` are server/developer-side fixture tooling only. Real values live in ignored `apps/mobile/.env.golden` and are never mobile public configuration.

This utility can prepare deterministic server/account fixtures. It does not create a mobile test-login button, does not count as Auth E2E evidence, and does not unlock Gate 02.

See `docs/GOLDEN_USER_001_GATE_01_SYNTHETIC_AUTH.md` for the server-fixture boundary.

## Gate 01 executable sequence

On the development Mac:

```bash
./scripts/run-ios-mobile.sh
```

Then execute in order:

1. verify the signed-out Auth surface appears when no valid session exists
2. complete an actually enabled Golden User login path against `palta-dev`; email passwordless is currently enabled
3. record the displayed canonical `Palta ID` and `Auth ID`
4. confirm exactly one matching canonical `public.palta_account` exists
5. terminate the app
6. relaunch and confirm the same session and `Palta ID`
7. sign out and confirm return to Auth
8. sign in again and confirm the same `Palta ID`
9. when Apple/Google are configured, exercise each provider and confirm no unintended duplicate Palta account is created
10. record exact evidence in `docs/GOLDEN_USER_001_GATE_01_AUTH_HANDOFF.md`
11. change Gate 01 to `E2E_VERIFIED` only after all required evidence exists

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
