# Palta Message Domain Timeline v1

Status: preflight contract / implementation baseline
Date: 2026-09-17

## Product rule

A Palta conversation may visually show both human communication and meaningful work/status changes in one chronological surface, but they remain different canonical records.

- Human text/voice/image/file -> Message Core `Message`
- Order/shipment/booking/service state -> owning domain core
- Domain state change shown in conversation -> durable Message timeline projection by reference

Palta must never convert a shipment state, booking state or repair state into a fake human chat message.

## Why the projection must be durable

Realtime alone is not sufficient.

If a user is offline while:

1. message sequence 8 is sent
2. shipment becomes `out_for_delivery`
3. business sends message sequence 10

then reconnect must recover:

`message 8 -> shipment event 9 -> message 10`

The domain-event projection therefore shares the same `msg_conversation.last_sequence` allocation space as human messages.

WebSocket/realtime only wakes or updates the client. PostgreSQL remains canonical.

## Canonical ownership

The owning domain keeps the real state and payload.

Examples:
- Commerce owns order/shipment/delivery state
- Reservation owns appointment lifecycle
- Service owns repair/work-order lifecycle
- Payment/Fiscal owns payment/receipt/fiscal state

Message Core stores only:
- Conversation ID
- Scope ID
- canonical Conversation sequence
- source Core
- immutable domain event ID
- semantic event type
- resource type + resource ID
- occurred/projected timestamps

It does not copy order bodies, delivery addresses, fiscal payloads, payment credentials, customer contact data or business-domain state blobs.

## Domain core does not know Conversation IDs

The domain should not be coupled to Message Core.

Preferred flow:

`Domain Core -> canonical.changed -> EventBus -> Message reverse routing -> Scope -> durable timeline projection`

A domain event contains only:
- `source` = owning Core
- `resourceType`
- `resourceId`
- semantic `changeType`
- immutable event ID
- occurredAt

Example:

`commerce / shipment / shipment-1001 / shipment.out_for_delivery`

Commerce does **not** need to know which user/business Conversation references that shipment.

## Reverse routing

`msg_scope_resource` is the authorization-backed relation between domain resources and Conversation Scopes.

Message Core performs an indexed reverse lookup:

`source_core + resource_type + resource_id -> linked Scope(s)`

Index:

`msg_scope_resource_source_lookup_idx`

Only active or resolved Scopes are routing candidates. Archived Scopes do not receive new projections.

This keeps the domain model independent and avoids user-wide scans, AI classification or copied relationship data.

## Fan-out guardrail

Conversation timeline is for relationship/task continuity, not broadcast publishing.

v1 reverse routing caps one resource change at 100 linked Scopes. If the lookup exceeds the cap, it fails explicitly instead of silently producing massive Message fan-out.

Large one-to-many updates belong in Update/Publishing + Notification Core, not Message Core.

## Projection transaction

For each target Scope:

1. lock `msg_conversation`
2. check `(conversation, sourceCore, domainEventId)` idempotency
3. verify Scope exists and belongs to Conversation
4. reject archived Scope
5. verify the resource is already linked/authorized in `msg_scope_resource`
6. allocate `last_sequence + 1`
7. insert `msg_timeline_domain_event`
8. update Conversation sequence/activity
9. insert transactional outbox event
10. commit

Projection + sequence + outbox therefore succeed or roll back together.

## Idempotency

Identity:

`conversation_id + source_core + domain_event_id`

Retry of the same event returns the existing projection and consumes no new sequence.

If the same domain event ID is reused for different Scope/event/resource metadata, Message Core rejects it as `IDEMPOTENCY_CONFLICT` instead of silently remapping history.

## Partial fan-out failure

A single canonical resource may legitimately be linked to more than one relationship Scope.

The projection consumer attempts every routed target even if one target fails. After the attempt:
- healthy targets may already be durably projected
- any failure makes the consumer attempt fail
- queue/EventBus retry can run again
- already completed targets replay idempotently
- failed targets can converge later

This gives retry-safe eventual convergence without pretending there is one distributed transaction across all Conversations.

## Realtime

A durable projection creates Message outbox event:

`message.domain_event_projected`

The realtime consumer publishes a lightweight envelope:
- conversationId
- scopeId
- sequence
- kind = `domain_event`
- refId = projectionId

No canonical domain payload is placed in the realtime envelope.

## Notification rule

`message.domain_event_projected` does **not** automatically create a notification candidate.

Timeline persistence answers:

> What happened in this relationship/task, and in what order?

Notification/Care policy answers:

> Is this change important enough to interrupt the user now?

The original canonical domain event can independently enter Care/Relevance/Notification rules. This avoids push spam from every internal status transition.

Human `message.created` remains eligible for the Message notification-candidate path.

## Public API boundary

Public/mobile clients may read the mixed timeline:

`GET /v1/messages/conversations/{conversationId}/timeline`

with sequence cursor pagination.

Public/mobile clients must not have a generic endpoint to create domain-event projections.

Projection creation is an internal Event/Core integration path only.

The existing `/messages` endpoint remains human-message sync. `/timeline` is the chronological combined view.

## Offline recovery

Because messages and projected domain events share one Conversation sequence, reconnect requires one cursor:

`after_sequence=N`

The client can deterministically recover all timeline entries after N and merge nothing locally by timestamp.

This is safer than separate message/status clocks and cheaper than replaying domain histories from every owning core.

## Cost profile

The normal path requires:
- one indexed `msg_scope_resource` reverse lookup
- one compact projection row per linked relationship event
- one Message outbox row
- optional realtime envelope

It requires no AI, no transcription, no domain payload duplication and no full-user scan.

This is intentionally compatible with low-cost managed PostgreSQL + queue/realtime adapters.

## Current implementation

- `canonicalChangeContract.ts`
- `timelineRoutingPort.ts`
- `postgresTimelineRouting.ts`
- `domainTimelineProjectionConsumer.ts`
- `timelinePort.ts`
- `postgresTimelinePersistence.ts`
- `conversationTimelineService.ts`
- `timelineApiContract.ts`
- mobile `listConversationTimeline()`
- `0008_message_domain_timeline_preflight.sql`
- Scope reverse-routing index in `0004_message_scope_ecosystem_preflight.sql`
- outbox/EventBus/realtime delivery for `message.domain_event_projected`
- mixed offline timeline tests
- reverse-routing/fan-out/idempotency tests

## Invariants

1. Human messages and domain events are distinct records.
2. Both share one canonical Conversation sequence.
3. Domain Core owns state; Message Core stores references only.
4. Domain Core does not need Conversation IDs for normal state-change publication.
5. Only previously authorized Scope resources can receive projections.
6. Archived Scopes receive no new domain projections.
7. Replayed domain events consume no new sequence.
8. Conflicting reuse of a domain event ID is rejected.
9. Projection persistence never automatically means push notification.
10. Relationship timeline is not a broadcast system.
11. Public clients may read projections but cannot generically create them.
12. The baseline flow works without AI.
