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

## Compact routine-life summary

Routine context must stay visually subordinate to personal action and status state.

- Weather, air quality, and relevant transport state belong in the compact `glance` cluster when normal.
- Normal glance cells use the minimum touch target and avoid large dashboard cards.
- Exchange rate and UF are grouped into one compact economy row when standard text sizing is active.
- Seasonal fruit, vegetables, and seafood are grouped into one compact `De temporada` row. The Food/Seasonality source still owns the facts; Home only compresses presentation.
- Accessibility text sizing falls back to the existing full summary rows rather than forcing one-line truncation.
- A routine signal must leave the compact treatment and enter `AHORA` when the owning adapter classifies it as action-changing, urgent, hazardous, or otherwise exceptional.

The compact treatment is presentation-only. It does not create another API contract or another copy of weather, economy, mobility, or food data.

## Municipal and local benefits

Municipal/public-life data enters Home only after source verification, locality matching, eligibility relevance, and current-validity checks.

- Ongoing relevant benefits use capability `today.municipal_benefit` and remain a short `PARA HOY` row.
- A deadline inside the attention window escalates to capability `now.admin_deadline` and the `AHORA` surface.
- Unverified, stale, wrong-locality, expired, undated non-ongoing, or unavailable records do not fill Home.
- Municipal benefits are not merged into the routine glance/economy/seasonality strip. They remain individually actionable because eligibility and deadlines matter.

## Density and mobile behavior

Existing density rules remain authoritative:

- no fixed card quota
- useful operational information survives before generic content
- content is reduced first on busy days
- quiet Home is valid
- unavailable or expired signals never become fake realtime values

This increment refines Home presentation density while keeping the navigation shell, auth, localization, theme, and shared API contract unchanged.