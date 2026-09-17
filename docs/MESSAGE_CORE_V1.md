# Palta Message Core v1

Status: integration contract / first implementation baseline

## Purpose

Message Core is Palta's provider-neutral communication layer. It stores and delivers conversations between people, businesses and organizations, while domain state remains owned by the relevant domain core.

The long-term rule is **AI-ready, AI-optional**: the service must work without paid AI, while transcripts, translation, summaries, intent extraction, action suggestions and moderation can be attached later without migrating canonical messages.

## Core boundaries

Message Core owns:
- Actor references used in conversation
- Conversation and participant state
- Durable messages
- Attachments by Media Core reference
- Sequence-based delivered/read state
- Conversation context references
- Action references
- Block/report state
- Outbox events for async delivery
- Optional, versioned AI artifact references

Message Core does not own:
- Quote values or quote lifecycle
- Reservation lifecycle
- Orders, payments, POS state or receipts
- Vehicle/property/listing/job canonical data
- Home/Care lifecycle
- Push device tokens
- Realtime provider storage

Those objects are linked by stable `resourceType + resourceId` references.

## Timeline rule

The UI may render human messages and domain events in one chronological surface, but they remain different canonical records.

Human message -> Message Core.
Domain state change -> owning Domain Core -> Event Core -> Message timeline projection/Home/Notification as appropriate.

## Delivery rule

1. Authorize actor and conversation access.
2. Persist message and allocate conversation sequence.
3. Persist Outbox event in the same durable operation.
4. Return accepted/persisted state to sender.
5. Async worker publishes through Realtime Adapter.
6. If recipient is offline, Notification Core may send push.
7. Reconnect uses sequence cursor sync; WebSocket loss must never lose a canonical message.

Realtime is a delivery optimization, not the source of truth.

## Read state

Participant state stores `lastDeliveredSequence` and `lastReadSequence`. Per-message read rows are not required for ordinary unread-count calculation. State only moves forward.

## Voice and AI

Voice is a first-class message type from v1, but automatic transcription is not required at launch. Audio is stored through Media Core/R2 by reference.

AI-derived data is stored separately as versioned artifacts:
- transcript
- translation
- summary
- intent
- entities
- suggested_action
- moderation

Original message content is never replaced by an AI result.

## Realtime provider boundary

Message Core depends only on `RealtimeAdapter`. Initial infrastructure may use Cloudflare realtime components; a secondary provider or future Palta-native implementation can replace it without changing Message contracts.

Typing and presence are ephemeral and are not durable messages.

## External channels

WhatsApp, email and other channels are external communication adapters, not replacements for Message Core. Palta must keep them easy to use. The advantage of internal Palta messaging is the automatic connection to canonical context and actions, not artificial lock-in.

## Reference journey: vehicle repair

1. User selects a canonical vehicle.
2. User opens a canonical business and starts `service_request` context.
3. Photos use shared Media Assets.
4. User may dictate text on-device or send a voice message.
5. Business replies in the conversation.
6. Business creates a Quote in Quote/Service domain; conversation receives a resource/action card reference.
7. User accepts or requests another quote through a domain action request.
8. Reservation is created by Reservation Core and linked to the conversation.
9. Reservation/domain events project into the same timeline and Home/Care as relevant.
10. Work progresses through Business/POS.
11. Payment/receipt and final repair record remain canonical in their owning cores.
12. Vehicle history links the completed service, while the conversation remains available as communication history.

The test passes only if Message Core connects every step without copying the canonical vehicle, quote, reservation, payment or repair state into message storage.

## v1 implementation scope

Implement now:
- User <-> Business 1:1
- text
- image/media references
- voice-message contract
- device dictation resulting in normal text
- replies
- delivered/read sequence state
- context references
- action references
- offline retry/idempotency
- push handoff contract
- block/report contract

Prepare but do not require at launch:
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
4. Message Core references domain objects; it does not own their state.
5. Human messages and system/domain events are distinct even if rendered together.
6. AI artifacts are optional, versioned derivatives.
7. Provider-specific code stays behind adapters.
8. External channels remain available; Palta wins by context and action continuity, not lock-in.
