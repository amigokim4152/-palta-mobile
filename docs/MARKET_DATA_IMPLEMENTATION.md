# Mercado data implementation handoff

Status: contract-ready, persistence implementation pending.
Source of Truth: `integration/market-v1`.

## Product boundary

Mercado v1 is person-to-person neighborhood goods only: sale, free giveaway, exchange and wanted posts.
Vehicles, property and jobs/services are separate Palta verticals.

## Canonical contracts

Implementation must conform to:

- `src/market/marketCatalog.ts`
- `src/market/marketLifecycle.ts`
- `src/market/marketMessageIntent.ts`
- `src/market/marketPersistenceContract.ts`
- `src/market/marketApiContract.ts`
- `src/market/marketHttpAdapter.ts`
- `src/market/marketAccessPolicy.ts`

Do not invent parallel models in SQL, Worker code or mobile UI.

## Provider boundary

Primary v1 database remains Supabase Postgres. Mercado does not own Shared Cores:

- Auth/Profile owns identity and authentication.
- Media Core owns image/video binaries and asset lifecycle.
- Message Core owns conversations/messages.
- Map/Location Core owns precise user location handling.
- Payment/Commerce Core is not required for Mercado v1 and must not be embedded into listings.

Mercado stores references to those systems only.

## Recommended persistence mapping

The infrastructure workstream may choose exact SQL names, but one logical record must exist for each canonical entity below.

### market_listing

Required logical fields:

- id UUID
- seller_user_id = Palta user id, never raw provider auth id in public payloads
- title
- description
- category
- trade_mode
- price_clp nullable; allowed only for `sale`
- status = draft / active / reserved / sold / withdrawn
- comuna_code nullable
- comuna_name
- area_ref nullable, coarse only
- created_at / updated_at / published_at
- version integer for optimistic concurrency

Indexes:

- `(status, published_at desc)` for discovery
- `(seller_user_id, updated_at desc)` for My listings
- `(comuna_code, status, published_at desc)` for local discovery
- category/trade-mode indexes only after query telemetry proves need

Do not store or expose exact home address, phone, email, raw latitude/longitude or provider auth id on the public listing record.

### market_listing_media

- listing_id
- media_asset_id from Media Core
- sort_order
- alt_text nullable
- unique `(listing_id, media_asset_id)`
- unique `(listing_id, sort_order)`

Mercado must not create a second blob bucket or image lifecycle.

### market_favorite

- listing_id
- user_id
- created_at
- unique `(listing_id, user_id)`

Favorites are private user state. Public APIs may expose only aggregate count.

### market_transaction

- id
- listing_id
- seller_user_id
- buyer_user_id
- status = coordinating / reserved / completed / cancelled
- conversation_id nullable reference owned by Message Core
- immutable listing snapshot captured when the transaction starts
- created_at / updated_at / completed_at nullable

The snapshot must preserve the minimum user-facing transaction context even after the public listing is sold, withdrawn or edited:

- listing_id
- title
- category
- trade_mode
- price_clp nullable
- comuna_name
- first media_asset_id nullable

The infrastructure workstream may store this as normalized immutable columns or a validated JSON object, but the API must return the canonical `MarketTransactionListingSnapshot`. Do not resolve the current mutable listing at review/history read time as a substitute for the snapshot.

Constraints:

- seller_user_id != buyer_user_id
- one active/reserved transaction per listing at a time
- completion is terminal
- transaction rows are visible only to participants and service role
- listing snapshot is written once when the transaction is created and is not rewritten by later listing edits

### market_transaction_review

- id
- transaction_id
- reviewer_user_id
- reviewee_user_id
- tags
- created_at
- unique `(transaction_id, reviewer_user_id)`

Only participants of a completed transaction may review. v1 uses structured trust tags rather than public free-text ratings.

## Public read model

Prefer a dedicated API/read projection rather than exposing base user-generated tables directly. Public discovery must return `MarketPublicListing` only.

The projection may contain:

- public listing fields
- public seller summary
- favorite count
- chat count if available from Message Core aggregation
- viewer-relative distance

It must not contain exact coordinates, exact address, contact details, raw Auth user id or private transaction state.

## Mutation boundary

All side effects enter through authenticated Palta API operations. Mobile must not receive direct INSERT/UPDATE/DELETE permissions for Mercado tables.

Canonical routes are declared in `MARKET_API_ROUTES` in `src/market/marketApiContract.ts`. HTTP serialization/parsing is defined by `src/market/marketHttpAdapter.ts`; internal TypeScript models remain camelCase while the Palta HTTP wire uses snake_case.

Server-side mutation order:

1. authenticate Palta user
2. validate command
3. authorize with `marketAccessPolicy`
4. enforce lifecycle/version constraints
5. persist transactionally
6. emit domain event for counters/feed/notifications where applicable
7. return canonical record/projection

## Listing lifecycle

Allowed transitions:

- draft -> active | withdrawn
- active -> reserved | sold | withdrawn
- reserved -> active | sold | withdrawn
- sold -> terminal
- withdrawn -> terminal

Public discovery includes only active and reserved listings. Sold and withdrawn listings disappear from the public feed while remaining available to authorized history views.

## Transaction lifecycle

Recommended server behavior:

- first serious buyer interaction may create `coordinating` and atomically capture the listing snapshot
- seller selects/accepts one buyer -> `reserved`; listing -> `reserved`
- seller confirms exchange -> transaction `completed`; listing -> `sold`
- either participant may cancel before completion; listing returns to `active` when no other reservation remains

A listing should not be marked reserved merely because a chat exists.

## Messaging handoff

Mercado emits `MarketMessageIntent` with:

- conversation type `transaction`
- context relation `listing`
- resource type `market_listing`
- listing id and label
- seller Palta actor id
- optional initial preset text

Message Core owns the resulting conversation id and messages. Mercado may persist only the conversation reference in a transaction.

## Location/privacy

Discovery may use exact viewer location transiently to rank/filter, but exact coordinates must not be included in public listing payloads. Seller-facing listing creation should persist only the chosen public area/comuna reference unless a future secure meeting-point feature explicitly requires more.

## Moderation hooks

The API implementation must leave explicit hooks for:

- hide listing per viewer
- report listing/seller
- suspend listing
- block user interaction through the shared safety/identity boundary

Do not overload listing status with moderation state if moderation needs independent audit history.

## Mobile live-runtime boundary

The feature-side live adapter is described in `docs/MARKET_LIVE_RUNTIME_HANDOFF.md`.

Mercado receives shared capabilities by injection:

- authenticated/optional-auth HTTP transport from the shared Palta API/Auth runtime
- coarse public area from Location Core
- media asset resolver and picker/uploader from Media Core
- conversation handoff from Message Core

Production must not fall back to development fixtures when any live dependency is absent.

## Implementation gate

Before applying a real migration to `palta-dev`:

1. infrastructure ownership for the migration is explicit;
2. Auth/Profile user identifier mapping is confirmed;
3. Media Core asset identifier is confirmed;
4. Message Core conversation reference contract is confirmed;
5. transaction listing snapshot storage is confirmed;
6. RLS/API policy is reviewed;
7. migration and rollback are tested against development data;
8. API responses pass `marketHttpAdapter` canonical parsing;
9. mobile dev fixtures remain dev-only until the real adapter passes composed runtime verification.
