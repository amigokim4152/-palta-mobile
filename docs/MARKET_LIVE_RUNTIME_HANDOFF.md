# Mercado live runtime composition handoff

Status: feature-side adapter ready; shared runtime wiring pending.
Source of Truth: `integration/market-v1`.
Whole-app integration owner: `integration/runtime-composition-v1`.

## Why this boundary exists

Mercado owns Mercado behavior and contracts, but it does not own the shared mobile API client, Auth/Profile, Media, Location or Messaging cores. The Mercado feature branch therefore exposes injection points instead of modifying shared runtime paths.

Do not solve integration by importing Supabase directly into Mercado screens, constructing storage URLs in Mercado, creating a Mercado-only chat client, or copying the shared API client.

## Feature-side entry points

Canonical domain/HTTP adapter:

- `src/market/marketApiContract.ts`
- `src/market/marketHttpAdapter.ts`

Mobile runtime boundary:

- `mobile-overlay/src/features/market/marketRuntime.ts`
- `mobile-overlay/src/features/market/marketRuntimeLive.ts`

The composition layer creates a `MarketRuntime` with `createMarketLiveRuntime(...)` and installs it with `installMarketRuntime(...)`.

## Shared transport contract

`MarketHttpTransport` is intentionally smaller than the shared Palta API client. It receives:

- HTTP method
- relative `/v1/market/...` path
- query values
- request body
- `auth: optional | required`

The composition/shared API layer remains responsible for:

- Palta API base URL
- bearer-token retrieval from canonical Auth/Profile
- actual `fetch`
- connectivity/retry policy
- global telemetry/correlation headers

Mercado must never receive or persist raw provider credentials.

## HTTP wire convention

Mercado domain types remain camelCase in TypeScript. The HTTP wire uses the existing Palta API convention of snake_case.

Examples:

- `tradeMode` -> `trade_mode`
- `priceClp` -> `price_clp`
- `mediaAssetIds` -> `media_asset_ids`
- `expectedVersion` -> `expected_version`
- `listingSnapshot` -> `listing_snapshot`
- cursor response `nextCursor` <- `next_cursor`

`marketHttpAdapter.ts` performs this translation and validates response shape before returning canonical domain records to the UI.

## Required API routes

Public/optional-auth reads:

- `GET /v1/market/listings`
- `GET /v1/market/listings/:listingId`

Authenticated reads:

- `GET /v1/market/me/listings`
- `GET /v1/market/listings/:listingId/favorite`
- `GET /v1/market/me/transactions`

Authenticated mutations:

- `POST /v1/market/listings`
- `PATCH /v1/market/listings/:listingId`
- `POST /v1/market/listings/:listingId/status`
- `PUT /v1/market/listings/:listingId/favorite`
- `POST /v1/market/transactions`
- `POST /v1/market/transactions/:transactionId/status`
- `POST /v1/market/transactions/:transactionId/reviews`

Non-2xx API responses should return a stable Mercado error code when possible. The adapter also maps HTTP 401/403/404/409/422/429/5xx and network failures to canonical Mercado errors.

## Location Core injection

`createMarketLiveRuntime` accepts `publicArea` as `MarketLocationSummary`.

It is a coarse public area only, normally comuna plus optional area reference. Exact coordinates and home addresses are not passed into listing persistence.

The sell screen refuses live publication when no public area has been supplied. Development preview may use its explicit Vitacura fixture.

## Media Core injection

`resolveMediaAssetUrl(mediaAssetId)` resolves display URLs through shared Media Core.

`selectListingMedia({ currentAssetIds, maxAssets })` performs the shared picker/upload flow and returns Media Core asset IDs that are ready to persist.

Mercado never creates a second upload/storage lifecycle. Live publication remains blocked at the photo step until this capability is injected.

## Messaging injection

`openMessageIntent(intent)` receives the canonical `MarketMessageIntent`:

- conversation type `transaction`
- context relation `listing`
- resource type `market_listing`
- seller Palta actor id
- optional initial quick-message text

Shared Messaging opens/creates the conversation. Mercado does not own conversation/message storage.

The user-facing Mercado screen must not expose internal terms such as "Message Core", adapter state, branch names or runtime integration notes.

## Runtime modes

### development_preview

- explicit development fixtures are allowed
- preview-only local mutations are allowed
- UI displays a preview indicator where relevant

### live

- real API read/mutation ports are installed
- public area comes from Location Core
- media comes from Media Core
- messages hand off to Messaging

### unavailable

- no fake production fallback
- screens show a normal user-facing unavailable state
- internal integration details remain out of product UI

## Composition implementation checklist

Before marking Mercado live in the composed runtime:

1. Build `MarketHttpTransport` on the composition/shared API side using the canonical API base URL and Auth/Profile token boundary.
2. Connect the Palta API endpoints above to `palta-dev`.
3. Supply a coarse `publicArea` from Location Core.
4. Supply Media Core asset resolver and picker/uploader.
5. Supply Messaging handoff when Message Core integration is available.
6. Create and install `createMarketLiveRuntime(...)` before Mercado screens read runtime state.
7. Verify anonymous discovery.
8. Verify authenticated favorite, create listing and My listings.
9. Verify transaction creation/reservation/completion and review eligibility.
10. Verify sold/withdrawn listings disappear from public discovery but transaction snapshots remain readable to participants.
11. Verify exact address, phone, email and raw latitude/longitude never appear in public listing payloads.
12. Verify production cannot show development preview listings when a live dependency is absent.
13. Run composed runtime TypeScript check and iOS bundle verification.

## Current external blockers

Feature-side contracts do not require these cores to be duplicated. Actual E2E completion depends on the corresponding shared integrations:

- real Mercado persistence/API implementation
- Media Core mobile selection/upload capability
- Location Core public-area capability
- Message Core composed-runtime handoff

These should be reconciled on their owning workstreams/composition branch, not implemented as Mercado-specific substitutes.
