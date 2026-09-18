# Golden User 001 — Runtime Verification Runbook

Status: ACTIVE
Branch: `integration/golden-user-001-v1`
Base: `integration/repository-normalization-v1`

## Purpose

This is the executable completion path for Somos Palta. A feature is not complete because a document, contract, type, screen, or mock exists. It is complete only when Golden User 001 can use it in the mobile runtime and the state survives the required persistence/re-entry checks.

## Completion states

Every gate uses exactly one of these states:

- `DOCUMENTED` — product/architecture intent exists only.
- `CORE_CODE` — provider-neutral/core implementation exists but is not proven in the mobile runtime.
- `RUNTIME_CONNECTED` — runtime adapter/provider is connected, but the complete user flow is not yet proven.
- `USER_FLOW_WORKING` — the user can complete the interaction in the app.
- `E2E_VERIFIED` — the interaction, canonical persistence, app restart/session restoration, permissions, and downstream linkage are verified.
- `BLOCKED` — the next Golden User action cannot proceed.

Only `E2E_VERIFIED` advances the Golden User to the next gate.

## Golden User 001

Golden User 001 is a synthetic development identity. It must never use a real citizen's RUT, phone number, private address, health record, or third-party OAuth identity as fixture data.

Stable test identity namespace:

- persona id: `golden-user-001`
- fixture marker: `synthetic=true`
- environment: development/test only

The persona is intentionally enriched only as each gate is reached. Do not pre-seed future-domain data to make later screens appear complete.

## Gate order

| Gate | User action | Current state | Advance condition |
|---|---|---|---|
| 01 Auth | Open app, create/sign in, leave app, return, sign out/in | `BLOCKED` | Same Palta identity/session is restored and account row is accessible under owner RLS |
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

## Gate 01 findings — 2026-09-18

Verified current facts:

1. The canonical mobile repository is `amigokim4152/palta-mobile`.
2. `main` is intentionally a minimal baseline; implementation work lives on `integration/*` branches.
3. Versioned mobile UI lives in `mobile-overlay/src`; generated runtime source must not become a second UI source of truth.
4. `integration/repository-normalization-v1` currently has only `src/auth/authCoordinator.ts` in `src/auth`, while the earlier `integration/auth-profile-core-v1` contains additional account/identity/session/resolver implementation. The branches therefore require reconciliation rather than assuming Auth Core is fully present in the normalized branch.
5. A real Supabase project named `palta-dev` exists and is ACTIVE_HEALTHY in `sa-east-1`.
6. The development database already contains `public.palta_account`; RLS is enabled and owner SELECT/UPDATE policies exist.
7. `palta_account` currently contains zero rows at the time of this check.
8. The normalized mobile route tree has no dedicated Auth route/screen and RootLayout has no Auth/session provider.
9. `.env.example` already reserves `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, but the example does not configure values.

Conclusion: Gate 01 is not complete. Database groundwork exists, but mobile Auth provider/session/UI/account bootstrap are not yet proven end-to-end.

## Gate 01 required work

Do not redesign authentication. Reuse the existing auth/profile contracts and current Supabase project.

User-touchable minimum surface:

- startup session check
- Sign in with Apple button
- Continue with Google button
- Continue with email button
- loading state
- provider/configuration error state
- retry
- sign out
- session-expired state
- account recovery/re-entry path appropriate to the chosen email method

Runtime requirements:

- Supabase client behind an Auth adapter/provider boundary
- publishable key only in the mobile client; never service-role/secret keys
- secure mobile session persistence
- stable `paltaUserId`; provider subject is not the canonical application identity
- first successful identity resolution bootstraps/locates the Palta account
- app restart restores the same user
- logout clears local session
- second login resolves the same account
- RLS proves one authenticated user cannot read another user's account
- failure/unavailable provider must be visible to the user instead of silently entering Home

## Gate discipline

When a gate blocks:

1. Stop Golden User progression.
2. Record the exact break here.
3. Fix only the blocker and its required integration boundary.
4. Verify on development runtime/data.
5. Mark `E2E_VERIFIED` only with evidence.
6. Continue to the next gate.

Do not jump ahead to Pets, POS, Community, or final visual polish while Gate 01 is blocked.

## Visual rule during Golden User execution

The UI may be visually rough. It may not be functionally incomplete.

Use the existing Palta design tokens/components where convenient, but defer final typography, illustration, motion, spacing polish, and brand refinement until the Golden User can complete the functional path. The final design pass must not invent missing actions; all required actions should already exist before visual consolidation.
