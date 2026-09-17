# Local Business Screen Reference v1

Status: IMPLEMENTATION REFERENCE

Palta learns interaction mechanics from Karrot/당근 but does not copy its visual design. The benchmark is whether a person can understand a nearby business and act faster, with less uncertainty.

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
- Persistent map surface.
- Explicit `Buscar en esta zona` after a user pan.
- Cluster tap smoothly expands the map.
- Business pin tap selects the same canonical result and opens an in-context preview.
- Bottom result sheet overlays the map; it must not resize the map surface.
- List and map use the same result set and selected Business ID.

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

## Where Palta must exceed the benchmark

- Operational truth is first-class: seasonal closure, today-only closure, stale/unknown hours and next-open projection.
- Service-area businesses remain discoverable without exposing a precise private/home location.
- Reviews are tied to verified use where possible.
- Quote, reservation, order and inquiry transition into shared Care/Messaging state instead of becoming dead-end contact buttons.
- After an action starts, ongoing state can surface through Care/Home rather than forcing the person to rediscover the business.
- Free external links remain useful; paid integration is for automation, not basic visibility.

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

Use the shared Palta theme and brand system. Borrow interaction clarity from benchmarks, never their proprietary visual identity. Keep one dominant action per moment, progressive disclosure, mobile-first touch sizes, and quiet empty space instead of filling every surface.
