# Golden User 001 — Runtime Verification Runbook

Status: ACTIVE
Branch: `integration/golden-user-001-v1`
Base: `integration/repository-normalization-v1`

## Purpose

This is the executable completion path for Somos Palta. A feature is complete only when Golden User 001 can use it in the mobile runtime and the required canonical persistence, permissions, and re-entry checks have been proven.

## Completion states

Every gate uses exactly one of these states:

- `DOCUMENTED` — product/architecture intent exists only.
- `CORE_CODE` — provider-neutral/core implementation exists but is not proven in the mobile runtime.
- `RUNTIME_CONNECTED` — runtime adapter/provider is connected, but the complete user flow is not yet proven.
- `USER_FLOW_WORKING` — the user can complete the interaction in the app.
- `E2E_VERIFIED` — interaction, canonical persistence, restart/session restoration, permissions, and downstream linkage are verified.
- `BLOCKED` — the next Golden User action cannot proceed because of a known unresolved blocker.

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

Gate 01 moved from `BLOCKED` to `RUNTIME_CONNECTED` after the missing integration boundaries were filled.

Verified implementation/data facts:

1. mobile UI Source of Truth remains `mobile-overlay/src`; generated runtime remains generated
2. Apple, Google, and email passwordless controls plus loading/error/retry/logout states are connected
3. Supabase session persistence uses Expo SecureStore and PKCE callback handling
4. mobile uses a publishable key only; privileged-key patterns are guarded by CI
5. Auth/Profile Core concepts were reconciled without restoring the older competing persistence model
6. raw provider subject, Supabase `AuthBrokerUserId`, and canonical `PaltaUserId` are explicit separate identity layers
7. `palta-dev` now has server-owned canonical `palta_account` bootstrap from `auth.users`
8. client INSERT on `palta_account` remains denied
9. real `palta-dev` transaction/RLS test proved user A cannot read user B account
10. generic Postgres migration preflight, root verify/tests, and generated Expo runtime typecheck all pass

Successful implementation verification runs:

- Core Check: `35335051087`
- Core CI + PostgreSQL preflight: `35335051144`
- Mobile Runtime Shell: `35335051197`

What remains `NOT VERIFIED` is the live mobile/provider cycle itself: fresh signed-out launch, real login, kill/relaunch restoration, logout, and login again to the same canonical account.

Therefore Gate 01 is **not** `E2E_VERIFIED`, and Gate 02 must not start yet.

## Gate 01 next executable sequence

1. launch the generated mobile runtime against `palta-dev`
2. verify the Auth surface appears with no valid session
3. complete the selected Golden User provider login
4. confirm the canonical `PaltaUserId`
5. terminate and relaunch the app; confirm the same session/account
6. logout and confirm return to Auth
7. login again and confirm the same `PaltaUserId`
8. exercise the remaining configured providers and confirm they do not create unintended duplicate Palta accounts
9. change Gate 01 to `E2E_VERIFIED` only after the evidence is recorded

If a provider/configuration/deep-link error occurs, stop at that exact failure and fix only that Gate 01 blocker.

## Gate discipline

When a gate blocks:

1. stop Golden User progression
2. record the exact break
3. fix only the blocker and its integration boundary
4. verify on development runtime/data
5. mark `E2E_VERIFIED` only with evidence
6. continue to the next gate

Do not jump ahead to Pets, POS, Community, or visual polish while Gate 01 remains below `E2E_VERIFIED`.
