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
- `src/market/marketMessagingFlow.ts`
- `src/market/marketPersistenceContract.ts`
- `src/market/marketApiContract.ts`
- `src/market/marketHttpAdapter.ts`
- `src/market/marketAccessPolicy.ts`

Do not invent parallel models in SQL, Worker code or mobile UI.

## Provider boundary

Primary v1 database remains Supabase Postgres. Mercado does not own Shared Cores:

- Auth/Profile owns identity and authentication.
- Media Core owns image/video binaries and asset lifecycle.
- Message Core owns durable conversations, scopes and messages.
- Map/Location Core owns precise user location handling.
- Payment/Commerce Core is not required for Mercado v1 and must not be embedded into listings.

Mercado stores stable references to those systems only.

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
- at most one `coordinating` or `reserved` transaction for the same `(listing_id, buyer_user_id)` at a time
- at most one `reserved` transaction per listing at a time
- multiple different buyers may have `coordinating` transactions for the same active/reserved listing
- completion is terminal
- transaction rows are visible only to participants and service role
- listing snapshot is written once when the transaction is created and is not rewritten by later listing edits
- once a transaction has a `conversation_id`, retries must not silently replace it with a different conversation id

A practical database implementation may use partial unique indexes for the two active constraints above. Exact SQL remains owned by the infrastructure workstream.

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

- buyer contact flow calls `startTransaction` only after Message Core has ensured the durable buyer↔seller conversation
- `startTransaction` ensures/reuses the buyer's existing `coordinating`/`reserved` transaction for that listing and atomically captures the listing snapshot on first creation
- immediate retries therefore converge instead of creating duplicate transaction rows
- if an existing active transaction already has a different non-null `conversation_id`, reject the mismatch rather than rebinding it silently
- a cancelled transaction is historical; a later contact may create a new coordinating transaction if the listing is still contactable
- seller selects/accepts one buyer -> that transaction becomes `reserved`; listing -> `reserved`
- seller confirms exchange -> transaction `completed`; listing -> `sold`
- either participant may cancel before completion; listing returns to `active` when the reserved transaction is released and the item is otherwise available

A listing must not be marked reserved merely because a chat or coordinating transaction exists.

## Messaging handoff

Message Core defines a conversation as a durable relationship. Mercado therefore **does not create one conversation per listing**.

Canonical flow from `marketMessagingFlow.ts`:

1. ask Message Core to ensure/reuse the durable buyer↔seller peer conversation;
2. call Mercado `startTransaction({ listingId, conversationId })` to ensure/reuse the buyer's active transaction for that listing;
3. open the durable conversation focused on `market_transaction:{transactionId}`;
4. optional quick-message text is sent/opened in that transaction context.

The concrete listing/transaction interaction belongs in Message Core as a `ConversationScope`, while the durable Conversation remains person-to-person. Scope creation/linking is internal-only in Message Core and must use the owning-domain authorization evidence required by Message Core. The mobile Mercado feature must not create ConversationScope rows directly.

The primary scope resource is `market_transaction`, not `market_listing`, because the transaction owns the coordination/reservation/completion lifecycle and immutable listing snapshot. A listing may still be shown as related context via the transaction snapshot.

If opening Messaging fails after the Mercado transaction has been created, retries must converge on the same active transaction and durable conversation. Do not fake a distributed atomic transaction between Mercado and Message Core.

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
- durable peer-conversation/opening bridge from Message Core

Production must not fall back to development fixtures when any live dependency is absent.

## Implementation gate

Before applying a real migration to `palta-dev`:

1. infrastructure ownership for the migration is explicit;
2. Auth/Profile user identifier mapping is confirmed;
3. Media Core asset identifier is confirmed;
4. Message Core durable conversation + transaction scope integration is confirmed;
5. transaction listing snapshot storage is confirmed;
6. active transaction/reservation uniqueness rules above are implemented and concurrency-tested;
7. RLS/API policy is reviewed;
8. migration and rollback are tested against development data;
9. API responses pass `marketHttpAdapter` canonical parsing;
10. mobile dev fixtures remain dev-only until the real adapter passes composed runtime verification.
