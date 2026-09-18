# Home Life Inbox Priority v1

Status: IMPLEMENTED CORE / RUNTIME EVENT TRANSPORT PARTIAL

## Purpose

Inicio remains a life inbox, not a portal. This increment extends the existing function-first Home without creating a second Home model or another Event Core.

## Ranking order

The stable semantic order remains authoritative:

1. urgent / safety / action-required state
2. in-progress personal state
3. scheduled upcoming state
4. useful-today operational information
5. passive content

User behavior only fine-tunes items inside that semantic model. It must never optimize session length, dwell time, click-through rate, or card volume.

## Privacy-minimized behavior profile

Home accepts bounded aggregate signals scoped by capability, source domain, or opaque subject id. Supported evidence is intentionally narrow:

- confirmed action completions
- explicit useful confirmations
- explicit not-relevant feedback
- explicit passive-content suppression

Home does not need raw interaction history, readable subject labels, dwell time, clickstream, or a cross-screen activity timeline.

The behavior adjustment is bounded and weaker than urgency/importance/relevance. Alerts and high-consequence items are protected from behavior demotion. Explicit suppression is applied only to passive `content` / `useful` items; action/alert state remains until the owning Core reconciles it.

## Event Core bridge

`src/home/homeEventBridge.ts` consumes the existing `EventBusPort` as an invalidation channel. It does not turn Event Core payloads into a parallel Home data source.

Events such as Care updates, canonical changes, relevance rechecks, live transit/weather/disaster updates, content publication, and notification candidates invalidate the Home projection. The canonical domain adapter or Care adapter still owns the resulting fact.

`notification.candidate` also invalidates the notification summary so the Inicio header count can refresh consistently.

The bridge contract is implemented. Wiring a live mobile realtime transport/subscription remains runtime work and is intentionally marked `partial` in the Home behavior capability registry.

## Density and mobile behavior

Existing density rules remain unchanged:

- no fixed card quota
- useful operational information survives before generic content
- content is reduced first on busy days
- quiet Home is valid
- unavailable or expired signals never become fake realtime values

This increment changes ordering inputs, not the visual grammar, navigation shell, auth, localization, theme, or shared API contract.
