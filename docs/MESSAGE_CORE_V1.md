# Palta Message Core v1

Status: integration contract / first implementation baseline

## Purpose

Message Core is Palta's provider-neutral communication layer. It stores and delivers conversations between people, businesses and organizations, while domain state remains owned by the relevant domain core.

The long-term rule is **AI-ready, AI-optional**: the service must work without paid AI, while transcripts, translation, summaries, intent extraction, action suggestions and moderation can be attached later without migrating canonical messages.

Palta must not force a user into an internal chat when WhatsApp, email, SMS, a web link or another route is more convenient. Internal Palta communication becomes valuable because it preserves authorized context, status, actions and follow-up across a relationship.

## Core boundaries

Message Core owns:
- Actor references used in conversation
- Long-lived Conversation and participant state
- Conversation Scope for a specific case/order/booking/shipment inside that relationship
- Durable messages
- Attachment references to provider-neutral Asset Core assets
- Sequence-based delivered/read state
- Relationship-wide conversation context references
- Scope resource references
- Action references
- Block/report state
- Transactional Outbox events for async delivery
- Optional, versioned AI artifact references

Message Core does not own:
- Physical media storage URLs, signed URLs or storage-provider object keys
- Quote values or quote lifecycle
- Reservation lifecycle
- Orders, shipments, payments, POS state or receipts
- Commerce customer delivery/share-token lifecycle
- Customer phone/email/address solely because another core needs it
- Vehicle/property/listing/job canonical data
- Home/Care lifecycle
- Push device tokens
- Realtime provider storage

Domain objects are linked by stable `resourceType + resourceId` references. Media is linked by stable `assetId` references owned by Asset Core.

## Conversation vs Conversation Scope

A Conversation represents a durable relationship, not one isolated transaction.

Example:

`User <-> Taller ABC` is one Conversation.

Inside it Palta may have separate scopes:
- `Honda · front bumper repair`
- `Nissan · maintenance`
- `September appointment`

A Message may belong to one scope or be unscoped general conversation. Scopes do not create separate message sequence spaces; the Conversation remains the durable ordered communication history.

This prevents both failure modes:
- creating a new chat for every quote/booking/order;
- mixing multiple vehicles/orders/cases into one undifferentiated context.

Relationship-wide references such as the business belong on Conversation Context. Case-specific references such as vehicle, service request, quote, booking, order, shipment, customer artifact or customer delivery belong on Conversation Scope.

## Timeline rule

The UI may render human messages and domain events in one chronological surface, but they remain different canonical records.

Human message -> Message Core.
Domain state change -> owning Domain Core -> Event Core -> Message timeline projection/Home/Notification as appropriate.

A quote card, reservation confirmation, shipment status or receipt shown in a conversation is a projection/reference to the canonical domain object. Editing the domain object never rewrites historical human messages.

## Delivery rule

1. Authorize actor and conversation access.
2. For media messages, authorize each Asset Core `assetId` for the authenticated principal/acting actor.
3. Persist message, attachment references and allocate conversation sequence.
4. Persist Outbox event in the same database transaction.
5. Return accepted/persisted state to sender.
6. Async outbox worker claims unpublished rows with a reclaimable lease.
7. Worker publishes immutable event IDs to the shared EventBus.
8. Realtime consumer emits a lightweight `RealtimeEnvelope`; Notification Core receives a separate `notification.candidate`.
9. Reconnect uses sequence cursor sync; WebSocket loss must never lose a canonical message.

Realtime is a delivery optimization, not the source of truth.

Outbox delivery is at-least-once. If a worker publishes an event and crashes before marking the row published, the event may be delivered again. Consumers therefore dedupe by immutable EventBus/outbox event ID. Palta prefers safe duplicate handling over silent message loss.

Notification candidates contain routing references only. Message body, attachment payload, customer phone/email/address and bearer/share tokens are not copied into the candidate event.

## Read state

Participant state stores `lastDeliveredSequence` and `lastReadSequence`. Per-message read rows are not required for ordinary unread-count calculation. State only moves forward and is capped at the canonical conversation `lastSequence`.

`message read` is never equivalent to a domain action. Reading a quote does not approve it; reading a booking update does not confirm attendance; reading a delivery update does not prove receipt of goods.

## Voice, attachments and Asset Core

Voice is a first-class message type from v1, but automatic transcription is not required at launch.

A voice-note send flow is:

1. Record locally.
2. Compress/encode on device according to the eventual native media policy.
3. Upload through Asset Core/storage adapter.
4. Receive a Palta provider-neutral `assetId`.
5. Message API sends `message_type=voice` with exactly one authorized voice attachment reference.
6. Message row + attachment reference + outbox event commit atomically.

Message Core never stores an R2/S3/Cloudinary/Supabase URL or provider object key. Initial physical storage may use R2, but that is an Asset Core/storage-adapter decision.

`message_media` is the durable Asset kind for canonical message media. `temporary_upload` may be used during upload/preparation, but an upload must be authorized/usable before Message Core attaches it.

Structural v1 rules:
- `voice` -> exactly one `voice` attachment
- `image` -> one or more `image` attachments
- `file` -> one or more `file` attachments
- other message types -> no direct attachment list
- maximum 10 attachments per message as an initial abuse/resource guardrail
- codec and voice-duration limit are intentionally not frozen yet

Device dictation is different from a voice note. Dictation normally follows:

`microphone -> OS/on-device speech recognition -> editable text preview -> normal text message`

The raw dictation audio should not be retained by Palta unless the user explicitly chooses to send a voice note or another product flow explicitly requires it. This is both a privacy and cost advantage.

## AI derivatives

AI-derived data is stored separately as versioned artifacts:
- transcript
- translation
- summary
- intent
- entities
- suggested_action
- moderation

Original message text/audio is never replaced by an AI result. A voice transcript is a derivative of the canonical voice asset, not a replacement for it. AI-extracted dates, amounts, booking times or action intents are candidates until the user/domain confirms them.

Server transcription is optional, not a prerequisite for voice messaging. On-device speech recognition should be preferred for dictation where the platform supports it; paid/server transcription can be used selectively later.

## Realtime provider boundary

Message Core depends only on `RealtimeAdapter`. Initial infrastructure may use Cloudflare realtime components; a secondary provider or future Palta-native implementation can replace it without changing Message contracts.

Typing and presence are ephemeral and are not durable messages.

## External channels

WhatsApp, email and other channels are external communication/delivery routes, not replacements for Message Core. Palta must keep them easy to use. The advantage of internal Palta messaging is the automatic connection to canonical context and actions, not artificial lock-in.

An external handoff must use truthful channel semantics. For example, a user-controlled WhatsApp click-to-chat handoff may be recorded as `handed_off`; it must not be called `delivered` without provider evidence.

## Commerce / POS / Delivery boundary

Commercial Core already owns:
- Customer Artifact
- short-lived/revocable Customer Share Link
- Customer Delivery
- Palta inbox / WhatsApp / system share / SMS / email / QR channel choice
- delivery status semantics
- customer relationship touchpoints
- transactional vs service-follow-up vs marketing permission separation

Message Core does not duplicate any of those records.

When Commerce has a legitimate customer phone/email for a transaction, that contact stays in the appropriate Commerce/CRM boundary. Message Core does not copy it merely to connect the experience.

A Commerce resource may be linked into a Conversation Scope after the owning domain authorizes the relationship. Message Core stores only:
- stable resource reference
- owning/source core
- optional non-secret authorization evidence reference
- access mode (`view_status`, `participate`, `communicate`)

It must never store a share-link bearer token, secure URL, fiscal payload, phone number, email address or delivery address as ecosystem-link metadata.

## Natural ecosystem entry

Reference flow for an order/delivery that begins outside Palta:

1. Merchant/POS completes an order or service in Commerce Core.
2. Commerce creates the appropriate Customer Artifact/status resource.
3. Commerce may create a short-lived share link.
4. Merchant sends it through the easiest route: WhatsApp, QR, system share, SMS, email or Palta inbox.
5. The lightweight web surface works without forcing app installation where policy allows.
6. If the customer chooses to sign in/open Palta, the owning domain verifies/authorizes the claim or relationship.
7. Only after that authorization does Message Core attach the order/shipment/delivery resource to a Conversation Scope.
8. Future canonical status changes can project into the conversation, Care/Home and Notification according to each core's policy.

Receiving a URL alone never grants access to unrelated customer history.

This is the intended ecosystem strategy: **external routes stay convenient; Palta becomes more convenient when continuity matters.**

## Reference journey: vehicle repair

1. User has one durable Conversation with the business.
2. User starts a `service_case` Scope for a canonical vehicle/service request.
3. Photos upload through Asset Core and the message stores only authorized asset references.
4. User may dictate text on-device or send a voice note.
5. Business replies in the same relationship conversation and scope.
6. Business creates a Quote in Quote/Service domain; scope receives a resource/action-card reference.
7. User accepts or requests another quote through a scoped domain action request.
8. Reservation is created by Reservation Core and linked to the same scope.
9. Reservation/domain events project into the same timeline and Home/Care as relevant.
10. Work progresses through Business/POS.
11. Payment/receipt and final repair record remain canonical in their owning cores.
12. If a receipt/service summary is shared through Commerce delivery, Message Core may reference the authorized artifact/delivery but does not copy customer destination data or share tokens.
13. A later Nissan job with the same business becomes a different Scope in the same Conversation.

The test passes only if Message Core connects every step without copying the canonical vehicle, quote, reservation, payment, delivery or repair state into message storage.

## v1 implementation scope

Implemented/preflight now:
- User <-> Business 1:1 service boundary
- durable relationship Conversation
- multiple Conversation Scopes per relationship
- scoped and unscoped messages
- text
- provider-neutral image/file/voice attachment references
- server-side attachment authorization boundary
- voice-message structural contract
- device dictation resulting in normal text
- replies
- delivered/read sequence state
- relationship context references
- scope resource references
- action references with optional scope
- privacy-safe ecosystem link contract
- offline retry/idempotency
- PostgreSQL persistence adapter
- transactional Outbox + reclaimable publisher lease
- shared EventBus bridge
- Realtime envelope consumer
- privacy-minimal Notification candidate handoff
- block/report schema contract

Prepared but not yet a production provider deployment:
- physical Asset Core upload/signing implementation
- concrete Realtime provider adapter
- scheduled/queue runtime wiring for outbox dispatcher
- final Notification recipient/offline/quiet-hours policy
- person-to-person public messaging
- groups at scale
- reactions
- server transcription
- translation
- AI summaries/action extraction
- calls/video
- E2EE

## Invariants

1. Durable DB is canonical; realtime is not.
2. A client retry cannot create duplicate messages.
3. Read/delivery sequence never moves backwards.
4. Conversation represents a durable relationship; Scope represents one specific job/case/order inside it.
5. Message Core references domain objects; it does not own their state.
6. Human messages and system/domain events are distinct even if rendered together.
7. AI artifacts are optional, versioned derivatives.
8. Provider-specific code stays behind adapters.
9. External channels remain available; Palta wins by context and action continuity, not lock-in.
10. A domain-authorized ecosystem link must not copy customer PII, secret share tokens or canonical payload into Message Core.
11. Transaction/service history never implies marketing consent.
12. A client-provided asset ID is never trusted without server-side Asset Core authorization.
13. Message Core stores provider-neutral asset IDs, never physical storage-provider URLs or secret access tokens.
14. Message/outbox/attachment references commit atomically or roll back together.
