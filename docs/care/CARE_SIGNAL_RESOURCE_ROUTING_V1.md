# Palta Care Signal & Resource Routing v1

Status: integration / pre-production

## 1. Purpose

Care Core remembers a user's lifecycle state and next meaningful action. It must not guess lifecycle meaning from every domain state change, and it must not become a second copy of Commerce, Delivery, Reservation, Health or other domain data.

The v1 rule is:

```text
Domain Core
  ├─ canonical.changed ──> Event/Conversation timeline projection
  └─ care.signal ────────> Care lifecycle transition
```

`canonical.changed` means only that canonical domain state changed.
`care.signal` is emitted only when the owning domain has explicitly mapped that change to a Care semantic event such as `wait`, `schedule`, `complete` or `require_follow_up`.

Message Core must not infer Care state from `canonical.changed`.
Care Core must not copy the domain payload.

## 2. Resource linkage

A Care Track follows canonical resources through `care_resource_link`.

Examples:

```text
care_track A
  ├─ commerce-core / order / order-123
  └─ delivery-core / shipment / shipment-456
```

The link stores stable provider-neutral IDs only. Customer phone, email, address, payment payload, message body and provider URL are not Care linkage data.

A resource may be linked only when:

1. the authenticated principal owns the Care Track;
2. the owning domain authorizes that principal to associate the canonical resource;
3. the resource ID is provider-neutral;
4. the database link is inserted idempotently.

The client cannot establish ownership by supplying a customer ID or contact value.

## 3. Care states: internal vs public

`care_track.state` uses the detailed internal machine vocabulary:

```text
discovered
preparing
action_started
waiting
upcoming
in_progress
result_available
completed
follow_up
outcome_recorded
blocked
cancelled
```

Home/API/mobile must not depend directly on those values. They use the stable display projection:

```text
discover
prepare
act
wait
result
follow_up
outcome
cancelled
```

`blocked` and waiting are orthogonal conditions. This allows the internal state machine to evolve without forcing UI/API migrations.

## 4. Signal contract

A `care.signal` carries lifecycle meaning and references only:

```text
sourceCore
resourceType
resourceId
careEvent
sourceSequence?        # preferred ordering key
expectedAt?
waitingForKey?
resultRef?
outcomeRef?
```

The Event Core event ID is the immutable signal idempotency key.

No arbitrary domain payload is embedded in the signal.

## 5. Idempotency and out-of-order delivery

Queue/EventBus delivery may retry or arrive out of order. Care application therefore locks the Care Track and the exact resource link in one PostgreSQL transaction.

Processing order:

1. lock Care Track;
2. lock matching resource link;
3. reject unlinked resource;
4. check `care_signal_receipt` for replay;
5. reject stale signal using `sourceSequence` when available;
6. otherwise use event occurrence time as a weaker stale guard;
7. validate the Care state transition;
8. update Care state and temporal fields;
9. advance resource-link ordering cursor;
10. insert signal receipt;
11. commit.

A replay causes no second transition.
A stale event is recorded with `ignored_stale` but does not regress Care.
An invalid semantic transition fails; it is not silently acknowledged as applied.

Domains with same-time lifecycle transitions should provide `sourceSequence`.

## 6. Fan-out boundary

Care reverse routing is relationship/lifecycle routing, not broadcasting.

`sourceCore + resourceType + resourceId` is looked up through an indexed `care_resource_link` query. v1 has a hard maximum of 100 target Care Tracks. Exceeding that limit is an error rather than silently turning Care into a broadcast mechanism.

Large one-to-many updates belong in Update/Publishing + Notification Core.

## 7. `care.updated`

After a Care Track actually changes, Care Core may publish a minimal `care.updated` event containing only routing/state identity such as:

```text
careTrackId
sourceSignalEventId
state
```

`care.updated` does not mean "send a push".

It is an input to projection/policy layers.

## 8. Home and Notification

The intended path is:

```text
care.signal
  -> Care state mutation
  -> care.updated
  -> domain presentation adapter
  -> HomeCandidate
  -> Home composition
  -> delivery policy
  -> Notification candidate only when justified
```

Care-to-Home defaults are intentionally quiet:

- waiting -> status;
- blocked/follow-up -> action candidate;
- ordinary waiting remains Home-only;
- blocked is not automatically a push;
- terminal outcome disappears from Home by default;
- a domain may intentionally show a fresh completion once;
- a domain may raise urgency only when an actual deadline, safety condition or operational need justifies it.

Home usefulness and notification eligibility remain separate decisions.

## 9. Message timeline interaction

One domain transition may legitimately produce two different semantic outputs:

```text
shipment.in_transit
  -> canonical.changed -> Conversation timeline reference
  -> care.signal(wait) -> Care lifecycle update
```

These are not duplicates:

- Conversation timeline answers: "what happened in this relationship/case?"
- Care answers: "what should Palta remember or do next for this user?"

Neither system copies the shipment canonical payload.

## 10. Cost and scale

The v1 path requires no AI call.

Normal processing is:

- indexed PostgreSQL reverse lookup;
- small reference rows;
- transactional state/receipt writes;
- EventBus/queue delivery;
- Home scoring and deterministic notification policy.

AI can later assist a domain in interpreting ambiguous unstructured input, but AI is not required for the Care lifecycle contract or storage model.

## 11. Privacy boundary

Care Core stores only what it needs to remember lifecycle state and stable resource references.

Canonical domain data remains in the owning core. Sensitive payload must be retrieved there under that core's authorization when a UI needs details.

Do not place these in Care signal/link tables:

- phone/email/address;
- payment data;
- raw private messages;
- provider credentials/tokens;
- full order/shipment/medical payloads;
- external provider URLs as canonical resource identity.

## 12. Current implementation boundary

Implemented on `integration/message-core-v1`:

- `care.signal` EventBus type and contract;
- resource reverse-routing port + PostgreSQL adapter;
- authorized Care resource-link service + PostgreSQL adapter;
- transactional signal application with replay/stale guards;
- `care_signal_receipt` audit/idempotency table;
- detailed-state -> stable-stage projection;
- quiet Care -> HomeCandidate policy;
- ephemeral PostGIS migration validation in CI.

Still intentionally not exposed as a public arbitrary write surface:

- raw `care.signal` creation;
- direct Care resource-link creation without owning-domain authorization;
- direct domain-event projection into Message timeline.

Production provider wiring and deployment remain separate from this preflight/integration contract.
