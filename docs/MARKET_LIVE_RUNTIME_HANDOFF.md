# Mercado live runtime composition handoff

Status: feature-side adapter ready; shared runtime wiring pending.
Source of Truth: `integration/market-v1`.
Whole-app integration owner: `integration/runtime-composition-v1`.

## Why this boundary exists

Mercado owns Mercado behavior and contracts, but it does not own the shared mobile API client, Auth/Profile, Media, Location, Messaging or Safety/Moderation cores. The Mercado feature branch therefore exposes injection points instead of modifying shared runtime paths.

Do not solve integration by importing Supabase directly into Mercado screens, constructing storage URLs in Mercado, creating a Mercado-only chat client, creating Mercado-specific moderation storage, or copying the shared API client.

## Feature-side entry points

Canonical domain/HTTP adapter:

- `src/market/marketApiContract.ts`
- `src/market/marketHttpAdapter.ts`
- `src/market/marketMessageIntent.ts`
- `src/market/marketMessagingFlow.ts`
- `src/market/marketSafetyIntent.ts`

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

`POST /v1/market/transactions` must ensure/reuse the current buyer's `coordinating`/`reserved` transaction for the listing. Immediate retries with the same durable conversation reference must converge on the same active transaction instead of producing duplicates.

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

`createMarketLiveRuntime` now accepts a `messaging: MarketMessagingPort` bridge rather than a listing-bound `openMessageIntent` callback.

The bridge has two responsibilities:

1. `ensurePeerConversation({ counterpartyUserId })`
   - asks Message Core to ensure/reuse the durable user↔user relationship;
   - must not include the listing id in Conversation identity;
   - returns the canonical `conversationId`.
2. `openConversation({ conversationId, focus, initialText })`
   - opens that same durable conversation;
   - `focus` is `sourceCore=market`, `resourceType=market_transaction`, `resourceId=<transactionId>`;
   - the composition/backend Message integration resolves/ensures the corresponding ConversationScope internally;
   - mobile Mercado must not call internal scope-creation endpoints directly.

`openMarketMessagingFlow(...)` owns the feature-side orchestration:

1. ensure/reuse buyer↔seller conversation;
2. Mercado `startTransaction({ listingId, conversationId })`;
3. reject a transaction that is already bound to a different conversation;
4. open the durable conversation focused on the returned transaction;
5. carry the optional quick-message text into that context.

Starting this flow creates/returns only a `coordinating` transaction. It must not reserve the item. Reservation remains an explicit seller-side Mercado lifecycle action.

If opening the conversation fails after transaction creation, retry is expected to converge on the same active transaction and durable relationship. Do not simulate cross-Core atomicity or delete a valid Mercado transaction as compensation.

The user-facing Mercado screen must not expose internal terms such as "Message Core", adapter state, branch names or runtime integration notes.

## Safety / moderation injection

`handleSafetyIntent(intent)` receives canonical Mercado safety intents from `marketSafetyIntent.ts`.

Supported v1 actions:

- `hide_listing`
- `report_listing`

Structured report reasons:

- `suspected_scam`
- `prohibited_item`
- `spam`
- `harassment`
- `misleading_listing`
- `other`

The intent carries the listing id and seller Palta actor id so the shared Safety/Moderation layer can apply viewer-specific hiding, audit reports, aggregate repeat abuse and escalate account-level enforcement where appropriate.

Mercado does not persist moderation audit state or overload the listing lifecycle with viewer hide/report state. Live UI must not claim success when the Safety handoff is unavailable.

## Runtime modes

### development_preview

- explicit development fixtures are allowed
- preview-only local mutations are allowed
- Safety actions may be simulated without production persistence
- UI displays a preview indicator where relevant

### live

- real API read/mutation ports are installed
- public area comes from Location Core
- media comes from Media Core
- durable peer conversations/opening come from Message Core
- hide/report actions hand off to shared Safety/Moderation

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
5. Implement `MarketMessagingPort.ensurePeerConversation` by reusing Message Core's canonical one-to-one relationship identity.
6. Implement `MarketMessagingPort.openConversation` so `market_transaction` focus is resolved to an internal Message Core ConversationScope with proper owner authorization evidence.
7. Supply shared Safety/Moderation handoff for hide/report intents.
8. Create and install `createMarketLiveRuntime(...)` before Mercado screens read runtime state.
9. Verify anonymous discovery.
10. Verify authenticated favorite, create listing and My listings.
11. Verify two listings between the same buyer/seller reuse one Conversation but create separate Mercado transaction contexts/scopes.
12. Verify repeated entry into the same active buyer/listing interaction reuses the active Mercado transaction.
13. Verify multiple buyers may coordinate on one listing while only one transaction may become `reserved`.
14. Verify starting chat never marks the listing reserved.
15. Verify transaction creation/reservation/completion and review eligibility.
16. Verify sold/withdrawn listings disappear from public discovery but transaction snapshots remain readable to participants.
17. Verify a hidden listing disappears for that viewer without changing global listing status.
18. Verify structured reports reach the shared Safety/Moderation audit path.
19. Verify exact address, phone, email and raw latitude/longitude never appear in public listing payloads.
20. Verify production cannot show development preview listings when a live dependency is absent.
21. Run composed runtime TypeScript check and iOS bundle verification.

## Current external blockers

Feature-side contracts do not require these cores to be duplicated. Actual E2E completion depends on the corresponding shared integrations:

- real Mercado persistence/API implementation with convergent transaction start semantics
- Media Core mobile selection/upload capability
- Location Core public-area capability
- Message Core composed-runtime bridge for durable peer conversation + transaction scope focus
- shared Safety/Moderation handoff

These should be reconciled on their owning workstreams/composition branch, not implemented as Mercado-specific substitutes.
