# Palta — Operator Relationship Messaging Contract

Date: 2026-09-17
Status: CANONICAL_REQUIREMENT
Scope: Palta operator ↔ Palta user / business-owner communication
Related: `LOCAL_BUSINESS_CUSTOMER_RELATIONSHIP_CONTRACT.md`, `LOCAL_BUSINESS_OWNER_PARTNER_DOCTRINE.md`

## 1. Purpose

Palta operator communication must be usable even when the operator does not speak fluent Spanish.

The core requirement is not merely that a customer can send a message. The message must be retrievable, understandable and replyable through an authorized AI-assisted operator workflow.

Canonical loop:

```text
customer / business owner
 -> Palta text message
 -> canonical conversation storage
 -> authorized operator-AI context projection
 -> Korean translation / summary for operator
 -> operator writes intent/reply in Korean
 -> AI prepares faithful natural es-CL reply
 -> operator reviews
 -> send into the same canonical conversation
 -> follow-up / commitment state remains linked
```

If an incoming message cannot be exposed through the authorized operator-AI path, the messaging system is incomplete for Palta operations.

## 2. Text is the canonical communication payload

Palta operator communication is text-first.

Voice may be used only as an input method that becomes text before normal message submission whenever device/platform capability permits.

Preferred direction:

```text
speaker talks
 -> device/system speech input
 -> Spanish text
 -> user confirms/edits if needed
 -> Palta receives text message
```

Default rule:
- do not require Palta to store raw voice notes for ordinary operator communication;
- do not require a paid server-side speech-to-text call merely because the user prefers speaking;
- if device/system speech recognition is unavailable, ordinary text input remains the fallback;
- raw audio, if ever introduced for a separate proven need, requires its own retention/privacy/cost policy.

## 3. AI-readable does not mean public

Messages must never be made public or broadly readable merely so AI can help the operator.

The system needs a purpose-bound, authenticated operator projection that can expose only the minimum context needed for the operator's work.

Possible projection:
- conversation id;
- participant display identity;
- participant role/context: user, business owner, provider, etc.;
- canonical `business_id` when relevant;
- current conversation purpose/context;
- recent message text;
- relevant unresolved commitment or follow-up;
- permitted business/profile facts needed to answer;
- permitted transaction/quote/booking/order context when the conversation is about that workflow;
- language metadata where useful.

Do not expose unrelated private profile, health, family, precise-location or other sensitive context simply because the operator is answering a business/support message.

## 4. Provider-neutral operator bridge

Shared Messaging Core should expose stable application contracts that an authorized AI assistant can consume through an adapter/connector.

Conceptual capabilities:

```text
list conversations needing operator attention
get conversation context
get recent authorized message text
prepare/return reply draft
send approved reply
mark handled / waiting
create or resolve follow-up commitment
```

The underlying message store must not depend on one AI vendor. A ChatGPT/OpenAI connector can be the first operator adapter, but canonical Conversation/Message truth remains Palta-owned and provider-neutral.

The user should not have to copy/paste customer text manually into ChatGPT as the normal operating model once the connector exists.

## 5. Operator experience

The operator-facing AI workflow should answer these questions immediately:

```text
Who is this?
What did they say?
What are they actually asking for?
What happened previously that matters now?
Did I promise anything?
What decision or answer is needed from me?
```

Preferred presentation to the Korean-speaking operator:

```text
Business/User: Panadería X
Context: business profile / coupon question

Korean meaning:
<faithful translation>

Key request:
- ...
- ...

Relevant prior context:
- ...

Pending commitment:
- ...

[Reply in Korean]
```

After the operator writes a Korean reply, AI may prepare a natural Chilean Spanish (`es-CL`) version. The operator remains the authority for the substantive promise, price, exception, refund, policy or business decision unless an approved deterministic policy authorizes automation.

## 6. No silent dead messages

An incoming operator-facing message must not disappear merely because AI/translation/connector processing fails.

Failure rule:

```text
message received successfully
 -> canonical text remains available
 -> AI bridge fails
 -> conversation stays unread/action_required
 -> operator can still see original text
 -> retry/alternate translation is possible
```

Never mark a conversation handled because AI failed to parse it.
Never auto-send a guessed response to hide an integration failure.

This is a release requirement, not an optional convenience.

## 7. Cost discipline

Do not spend AI money on every message merely because it exists.

Preferred cost model:
- message transport/storage operates without generative AI;
- speech input should preferably become text on the device/system side;
- AI translation/summary runs when operator attention is actually needed or when an approved batch/triage policy has clear value;
- one AI call should combine translation + concise summary + request extraction where practical;
- deterministic metadata such as unread state, business id, conversation age and workflow state should be computed without LLM calls;
- long conversation context should use bounded recent messages plus structured relationship/commitment summaries rather than resending the entire lifetime history on every turn.

## 8. Relationship continuity

The operator should be able to remember useful commitments without turning every raw message into permanent memory.

Possible structured operator relationship fields:
- last meaningful contact;
- current help/request summary;
- unresolved commitment;
- next follow-up date/reason;
- preferred communication mode where explicitly learned;
- business/user relationship stage only when operationally useful.

Raw conversation retention and structured relationship memory are different concerns. Preserve only what is legitimately useful under the applicable retention policy.

## 9. Communication preference

For Palta operator relationships, asynchronous text is the preferred default.

Voice input may produce text, but ordinary communication should not require live phone calls.
When trust or a deeper human relationship is more useful, an in-person meeting may be preferable to a difficult live call. The system should support preparing the operator before the meeting and recording legitimate commitments afterward.

Phone remains an optional external channel, not the default or required escalation path.

## 10. Shared-Core boundary

Shared Messaging Core owns:
- canonical Conversation/Message identity;
- participant authorization;
- message transport;
- unread/read/handled state where applicable;
- retention/deletion policy;
- realtime/push events;
- channel adapters where shared;
- AI-readable operator access contract.

Operator Relationship layer owns:
- operator work queue/projection;
- Korean-facing interpretation workflow;
- relationship/follow-up context;
- operator-approved reply flow;
- meeting preparation/follow-up.

Local Business may reference this contract for business-owner conversations but must not implement a second Messaging Core.

## 11. Acceptance tests for future Messaging development

Messaging is not complete until all of the following are true:

1. A Spanish customer/business-owner text message is stored canonically.
2. The authorized operator can retrieve that message without manual database access.
3. The authorized AI/operator connector can retrieve the same permitted text/context.
4. AI can present a Korean translation/summary without changing canonical message truth.
5. The operator can write the intended response in Korean.
6. AI can produce an es-CL reply draft for operator review.
7. The approved reply can be sent back into the same conversation.
8. If AI is unavailable, the original message remains visible and action-required.
9. No raw voice file or paid speech transcription is required for the normal speech-input path.
10. No unrelated private user data is exposed merely to enable translation or reply drafting.

Canonical requirement:

> **A Palta message that the authorized operator-AI workflow cannot read and help answer is an unfinished message implementation.**
