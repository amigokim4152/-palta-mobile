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

## Gate order

| Gate | User action | Current state | Advance condition |
|---|---|---|---|
| 01 Auth | Open app, create/sign in, leave app, return, sign out/in | `RUNTIME_CONNECTED` | Same Palta identity/session is restored and account row is accessible under owner RLS |
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

Gate 01 is `RUNTIME_CONNECTED`. Known implementation blockers have been removed; what remains is real simulator/device/provider evidence.

Verified implementation/data facts:

1. mobile UI Source of Truth remains `mobile-overlay/src`; `apps/mobile/src` remains generated
2. Apple, Google, and email passwordless controls plus loading/error/retry/logout states are connected
3. Supabase session persistence uses Expo SecureStore and PKCE callback handling
4. the Auth adapter fails closed when public Supabase configuration is absent or invalid
5. mobile application source contains no hardcoded Supabase environment binding; CI enforces the boundary
6. `.env.example` uses the same `EXPO_PUBLIC_ENV` contract as runtime code and is validated by `npm run verify`
7. Auth/Profile Core concepts were reconciled without restoring the older competing persistence model
8. raw provider subject, Supabase `AuthBrokerUserId`, and canonical `PaltaUserId` are explicit separate identity layers
9. `palta-dev` has server-owned canonical `palta_account` bootstrap from `auth.users`
10. client INSERT on `palta_account` remains denied
11. real `palta-dev` transaction/RLS test proved user A cannot read user B account
12. generic PostgreSQL migration preflight, root verify/tests, generated Expo runtime typecheck, and Expo canonical config checks all pass
13. the macOS iOS launcher now injects the public `palta-dev` development Auth configuration and validates it before launch

Latest successful verification baseline before these documentation updates:

- commit: `2aae9ebc8f9dd1e3264952ff34c7c7fb5027eaff`
- Core Check: `35335940242` — SUCCESS
- Core CI + PostgreSQL preflight: `35335940202` — SUCCESS
- Mobile Runtime Shell: `35335940196` — SUCCESS

What remains `NOT VERIFIED` is the live mobile/provider cycle itself: fresh signed-out launch, real login, terminate/relaunch restoration, logout, and login again to the same canonical account.

Therefore Gate 01 is **not** `E2E_VERIFIED`, and Gate 02 must not start yet.

## Gate 01 executable sequence

On the development Mac:

```bash
./scripts/run-ios-mobile.sh
```

Then execute in order:

1. verify the Auth surface appears with no valid session
2. complete the selected Golden User provider login against `palta-dev`
3. confirm and record the canonical `PaltaUserId`
4. terminate the app
5. relaunch and confirm the same session/account
6. sign out and confirm return to Auth
7. sign in again and confirm the same `PaltaUserId`
8. exercise remaining configured providers and verify no unintended duplicate Palta account is created
9. record exact evidence in `docs/GOLDEN_USER_001_GATE_01_AUTH_HANDOFF.md`
10. change Gate 01 to `E2E_VERIFIED` only after all required evidence exists

If a provider/configuration/deep-link error occurs, stop at that exact failure and fix only that Gate 01 blocker.

## Database hardening scope note

The latest Supabase security-advisor pass contains existing PostGIS/public-schema findings. They are tracked separately and must not be “fixed” by an untested PostGIS relocation/drop while Gate 01 is being verified. `business_registration_intake` currently has RLS enabled and no anon/authenticated CRUD grants, so the no-policy finding does not create client access by itself.

See `docs/GOLDEN_USER_001_GATE_01_AUTH_HANDOFF.md` for the recorded advisor findings and the rule for planned PostGIS hardening.

## Gate discipline

When a gate blocks:

1. stop Golden User progression
2. record the exact break
3. fix only the blocker and its integration boundary
4. verify on development runtime/data
5. mark `E2E_VERIFIED` only with evidence
6. continue to the next gate

Do not jump ahead to Pets, POS, Community, or visual polish while Gate 01 remains below `E2E_VERIFIED`.
