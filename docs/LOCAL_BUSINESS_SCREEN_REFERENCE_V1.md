# Local Business Screen Reference v1

Status: IMPLEMENTATION REFERENCE

Palta learns interaction mechanics from Karrot/당근 but does not copy its visual design. The benchmark is whether a person can understand a nearby business and act faster, with less uncertainty, and whether a small merchant can understand what matters today without learning a complex SaaS dashboard.

## Product rule

A Business is one canonical object projected into discovery list, map pin, map preview, profile, public web, owner console and Care. Screens must not create separate business copies or lose discovery context when navigating.

## Screen A — Negocios discovery

### Three-second decision
A result card should answer, without opening the profile:
1. What is this business?
2. Can I use it now?
3. How far / what area does it serve?
4. What are the one or two most relevant services?
5. Is there one useful current reason to look now (benefit or fresh update)?

### Layout priority
- Contextual search input.
- Only a few quick category shortcuts.
- **Default view is a dense, useful business list.** A person should see real choices immediately instead of an empty map canvas.
- `Lista / Mapa` are peer views of the same result set, filters, selected Business ID and search context.
- Map is one tap away and restores the same camera/search context.
- Explicit `Buscar en esta zona` after a user pan.
- Cluster tap smoothly expands the map.
- Business pin tap selects the same canonical result and opens an in-context preview.
- Bottom result sheet overlays the map; it must not resize the map surface.
- Returning from Business Profile restores the prior discovery context rather than starting over.

### Result card anatomy
- Optional real cover photo; no fake stock photo when missing.
- Business name.
- Current operating truth (`Abierto ahora`, `Cerrado hoy`, `Cerrado por temporada`, `Horario por confirmar`).
- Distance when exact public location exists, otherwise `Zona de atención`.
- Up to two service/category labels.
- Verification only as a compact trust cue, not the headline.
- At most one current highlight (active benefit or useful fresh update).

Do not turn cards into dashboards. Do not show every capability, social link, review, or campaign in search results.

## Screen B — Business Profile

The first viewport should answer:
1. Where/what is this?
2. Is it usable now?
3. What can I do next?

Recommended information order:
1. Back to the preserved discovery session.
2. Real business photos when available.
3. Name + concise category/service identity + verification cue.
4. Current operating state + distance/service area.
5. Primary actions relevant to this business (WhatsApp / Consultar / Cotizar / Reserva etc.).
6. Save / Follow relationship actions.
7. Core services and short description.
8. Active benefit.
9. Verified-use reviews.
10. Recent useful updates.
11. Hours and service area detail.
12. Existing external channels.
13. Correction/report entry point.

A profile is living local content, not a static directory record.

## Screen C — Mi negocio / Business Partner Home

The owner home is not a module launcher and not an upsell wall. It should answer:
1. How is my business operating today?
2. Is there anything that actually needs my attention?
3. Is there a real customer relationship item I should respond to?
4. What free/basic information should I keep correct?
5. Only if repeated work exists: is there automation that could save time?

Recommended information order:
1. Compact verification context; do not waste the first card on account status alone.
2. `Hoy`: current operating truth and today's hours.
3. Actual attention items: corrections, stale critical facts, pending commitments or other action-required guidance.
4. Real relationship signals that exist in Palta, such as verified-use reviews requiring a response.
5. Useful free suggestions before any commercial suggestion.
6. Free canonical profile management: profile/contact, services, hours, location/service area, public links, posts and basic coupon where eligible.
7. Paid/automation suggestion only when `may_be_paid` guidance is backed by an observed repeated burden or useful workflow.

Do not invent analytics to make the screen look populated. No fake visitors, searches, leads, revenue, response counts or conversion metrics. If Palta does not have a trustworthy measurement yet, leave it out.

When nothing needs attention, the correct screen can say `Todo tranquilo por ahora` and remain quiet.

## Where Palta must exceed the benchmark

- Operational truth is first-class: seasonal closure, today-only closure, stale/unknown hours and next-open projection.
- Service-area businesses remain discoverable without exposing a precise private/home location.
- Reviews are tied to verified use where possible.
- Quote, reservation, order and inquiry transition into shared Care/Messaging state instead of becoming dead-end contact buttons.
- After an action starts, ongoing state can surface through Care/Home rather than forcing the person to rediscover the business.
- Free external links remain useful; paid integration is for automation, not basic visibility.
- Owner guidance is partner-oriented: observation → why it matters → one practical action. Free/manual solution comes before paid automation.

## Interaction continuity

`DiscoveryState` must survive list ↔ map ↔ profile ↔ Care navigation:
- query
- filters
- search origin
- map camera
- selected Business ID
- sheet snap state

Short-lived discovery result cache may be memory-only for smooth return. Precise search context must not be silently persisted to disk.

## Visual principle

Use the shared Palta theme and brand system. Borrow interaction clarity from benchmarks, never their proprietary visual identity. Keep one dominant action per moment, progressive disclosure, mobile-first touch sizes, and useful density without filling every surface. The default `Negocios` screen must look like a usable local-business product, not a map developer preview.