# Palta Message Scope Integration v1

Status: preflight contract / implementation baseline
Date: 2026-09-17

## Product rule

`Conversation` = durable relationship.

`ConversationScope` = one concrete job/case/order/booking/shipment context inside that relationship.

A POS order, delivery, service request or later receipt must not create a new chat when the user and business already have a durable Conversation.

Example:

`User A <-> Taller B` = one Conversation.

Inside it:
- Scope 1: Toyota brake repair
- Scope 2: Nissan maintenance
- Scope 3: later tire replacement

Each Scope may reference canonical resources owned by other cores without copying their payload.

## Internal-only integration boundary

Scope creation/linking is not a public mobile endpoint.

The internal flow is:

1. Relationship Conversation already exists or has been legitimately established.
2. Owning domain identifies the canonical primary resource, such as `order`, `service_request` or `booking`.
3. Owning domain produces an opaque, non-secret authorization evidence reference.
4. `ConversationScopeService` verifies the resource link through `ScopeResourceAuthorizationPort`.
5. Message Core ensures one Scope for the primary resource inside that Conversation.
6. Related resources such as shipment, delivery, receipt or payment reference may then be attached after independent authorization.

A phone number, email address, delivery address or share-link possession is never sufficient authority to create or link a Scope.

## Canonical Scope identity

PostgreSQL table: `msg_scope_identity`.

Identity key:

`conversation_id + source_core + resource_type + resource_id`

The primary resource therefore resolves to one Scope inside one Conversation even when POS/Commerce/Delivery retries the same integration.

Creation uses:

1. `INSERT ... ON CONFLICT DO NOTHING`
2. `SELECT ... FOR UPDATE`
3. existing `scope_id` -> reuse
4. missing `scope_id` -> create Scope + primary resource reference + bind identity in the same transaction

This prevents duplicate work contexts under concurrent or repeated delivery.

## PostgreSQL implementation

`PostgresConversationScopeDirectory` owns the durable adapter for:
- ensure/reuse by primary-resource identity
- Scope lookup
- idempotent resource attachment
- resolve
- archive

The Message Core DB stores only:
- Scope ID
- Conversation ID
- domain-neutral Scope type / optional safe label
- Scope lifecycle state
- stable resource references
- source core
- non-secret authorization evidence reference
- access mode
- optional snapshot version

It does not store canonical order, shipment, payment, receipt or customer payloads.

## POS / Commerce reference flow

Example:

`order-501` is the primary resource.

The internal call may ensure one order Scope and attach:
- `shipment-501`
- `customer_delivery-501`
- later `receipt-501`

Conceptually:

`Conversation -> Scope(order-501) -> shipment -> delivery -> receipt`

The Conversation remains unchanged. A future unrelated order from the same business receives another Scope in the same Conversation.

## Multi-resource integration

`ConversationScopeService.ensureWithAuthorizedResources()` is an internal convenience flow for POS/Commerce/Delivery.

Rules:
- primary resource is authorized first
- at most 20 related resources per command in v1
- related resources cannot use relation `primary`
- duplicate `relation + resource_type + resource_id` values in one command are collapsed
- every related resource is independently authorized
- every attachment is idempotent

## Partial failure and retry

The integration is deliberately **not** one distributed transaction across Message Core and every owning domain.

Example:

1. order Scope authorized and persisted
2. shipment link authorized and persisted
3. receipt authorization temporarily fails
4. integration returns failure
5. caller retries later
6. same Scope is reused
7. existing shipment link is reused
8. receipt is attached when authorization succeeds

This is preferred to pretending cross-service atomicity exists. The system is retry-safe and converges without duplicate Scopes/resources.

## Conversation boundary

Before attaching a related resource:

1. Scope is loaded.
2. Scope must exist.
3. Scope `conversationId` must equal the requested Conversation.
4. Only then is owning-domain authorization consulted.
5. Adapter re-checks Conversation ownership defensively before writing.

This prevents a legitimate resource authorization from being replayed into another relationship Scope.

## Lifecycle

Scope lifecycle is monotonic:

`active -> resolved -> archived`

Rules:
- resolve retry preserves the first `resolved_at`
- archive retry preserves the first `archived_at`
- resolving an archived Scope does not reopen it
- Scope lifecycle is Message relationship metadata, not the canonical order/service lifecycle

Canonical business state still belongs to the owning domain and reaches Home/Care/Notification through normal domain/Event Core flows.

## Privacy boundary

Scope integration must not copy:
- customer phone
- customer email
- delivery address
- payment credential
- fiscal payload
- customer share-link bearer token
- storage-provider URL/token

`authorization_evidence_ref` is an opaque, non-secret identifier proving that the owning core performed authorization. It is not the authorization secret itself.

## Current implementation

- `scopeAuthorizationPort.ts`
- `scopeDirectoryPort.ts`
- `conversationScopeService.ts`
- `postgresConversationScopeDirectory.ts`
- `ecosystemBridge.ts`
- `0004_message_scope_ecosystem_preflight.sql`
- `0007_message_scope_identity_preflight.sql`
- Scope lifecycle/PostgreSQL adapter tests
- POS/Delivery batch integration + partial-retry tests

## Invariants

1. Same primary resource in the same Conversation -> same Scope.
2. Scope creation/linking is internal and authorization-gated.
3. Domain objects remain canonical in their owning cores.
4. Message Core stores references, never copied transactional payloads.
5. Resource attachment cannot cross Conversation boundaries.
6. Related resource retries do not create duplicate links.
7. Partial integration failure is recoverable by retry.
8. Scope state never moves backwards.
9. External channel contact data does not establish Palta identity or Scope authority.
10. POS/order/shipment/receipt context belongs in Scope, not a new Conversation.
