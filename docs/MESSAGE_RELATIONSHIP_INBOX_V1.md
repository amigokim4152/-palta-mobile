# Palta Message Relationship & Inbox v1

Status: preflight contract / implementation baseline
Date: 2026-09-17

## Product rule

A Palta `Conversation` represents a durable relationship. It does not represent one order, one shipment, one quote or one appointment.

For example:

`User A <-> Business B` = one durable Conversation.

Inside that Conversation, separate work is represented by `ConversationScope`:
- order 1001
- shipment 1001
- Honda repair
- Nissan maintenance
- September appointment

Entering the same relationship from a business profile, Local Business, quote flow, POS receipt, delivery status or later follow-up must not create duplicate chats.

## Why this matters

A transaction-per-chat model creates fragmentation:
- the user cannot remember which thread contains the relevant promise;
- the business sees the same customer scattered across multiple conversations;
- quotes, bookings, shipments and warranties lose continuity;
- duplicated relationship records increase storage and notification noise.

Palta therefore keeps one relationship Conversation and separates individual work with Scopes and domain references.

## User-initiated business conversation

Public mobile API:

`POST /v1/messages/businesses/{businessId}/conversation`

Rules:
1. The authenticated session identifies the user.
2. The request never accepts a customer `user_id`, phone, email or address.
3. Business Core decides whether Palta internal messaging is available for the business.
4. Message Core canonicalizes the User/Business actor pair.
5. Existing pair -> reuse the existing Conversation.
6. New pair -> create Conversation + participants atomically.
7. Repeated entry from any user-facing surface returns the same Conversation ID.

## Business/POS/Delivery-initiated relationship

A merchant having customer contact information does **not** authorize Message Core to discover or attach that person to a Palta account.

A public endpoint must not accept:
- business ID + arbitrary customer Palta user ID
- phone number -> Palta identity lookup
- email -> Palta identity lookup
- share-link bearer token -> Conversation creation

For POS/delivery flows that begin outside Palta:
1. Commerce owns the transactional customer information it legitimately needs.
2. Commerce may issue a short-lived/revocable share link or handoff via WhatsApp/SMS/email/QR/system share.
3. The lightweight status/artifact surface works without forcing app installation where policy permits.
4. If the customer signs in or claims the relationship, the owning domain verifies that claim.
5. Only a trusted internal domain flow with authorization evidence may then attach the order/delivery resource to a Palta Conversation/Scope.
6. Message Core stores the authorized resource reference, not the customer phone/email/address or share token.

This lets external channels remain convenient while making Palta more useful when continuity matters.

## One-to-one identity

PostgreSQL preflight table: `msg_one_to_one_identity`.

The actor pair is canonicalized by `actor_type + actor_id`, so:
- `(user U, business B)`
- `(business B, user U)`

resolve to the same relationship identity.

Creation uses an identity row lock in the same transaction to prevent concurrent requests from producing duplicate Conversations.

## Inbox

Public mobile API:

`GET /v1/messages/conversations`

Default actor = authenticated user.

An authorized staff member may request a business/organization/community Inbox with `acting_actor_type` + `acting_actor_id`, but the authenticated principal is injected by the server and verified through the authorization boundary.

The public response never exposes the staff principal audit identity.

Inbox item contains:
- Conversation summary
- counterpart Palta actor references
- incoming unread count
- optional last-message preview

Names, avatars, business metadata and user profiles remain in their owning cores and can be hydrated by the presentation layer.

## Unread rule

Unread count is **incoming unread**, not `last_sequence - last_read_sequence`.

The actor's own messages after the read cursor do not count as unread.

Conceptually:

`count(messages where sequence > last_read_sequence and sender != current_actor)`

Read cursor still advances monotonically at Conversation level and is capped at canonical `last_sequence`.

## Inbox pagination

Use keyset pagination:

`last_activity_at DESC, conversation_id DESC`

Cursor is the pair:
- `after_activity`
- `after_conversation_id`

Both values are required together. Offset pagination is not used for the relationship Inbox.

## Privacy boundary

Relationship identity and Inbox do not copy:
- phone
- email
- delivery address
- payment data
- share-link token
- provider access token
- employee principal identity into public response

The Inbox identifies counterparties by Palta actor references only. Domain/presentation layers may hydrate authorized display data separately.

## Current implementation

- `conversationIdentity.ts`
- `conversationDirectoryPort.ts`
- `conversationEligibilityPort.ts`
- `conversationDirectoryService.ts`
- `postgresConversationDirectory.ts`
- `conversationApiContract.ts`
- mobile `openBusinessConversation()`
- mobile `listConversationInbox()`
- `0006_message_relationship_inbox_preflight.sql`
- relationship/inbox/API/mobile contract tests

## Invariants

1. Same one-to-one actor pair -> same durable Conversation.
2. Order/quote/booking/shipment/service case -> Scope, not new chat.
3. Actor pair order cannot create duplicate relationship identity.
4. Business eligibility/verification stays in Business Core.
5. Business employee authority is verified server-side.
6. Customer PII in Commerce does not become Message Core identity data.
7. External share-link possession does not grant unrelated history or Conversation creation.
8. Inbox unread count excludes the current actor's own messages.
9. Inbox pagination is keyset-based.
10. Public API never exposes internal employee principal audit identity.
