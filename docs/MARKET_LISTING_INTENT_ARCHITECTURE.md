# Mercado listing-intent architecture

## Boundary

Mercado owns explicit listings and transaction intent. Negocios owns canonical Business discovery/profile data. They are linked, never merged.

A Mercado listing may contain `sellerBusinessId`/public `seller.businessId` as a reference to a canonical Business. Mercado must not copy the Business profile, hours, contacts, reviews or other Business-owned state into the listing object.

## Verticals

Canonical vertical keys are language-neutral:

- `secondhand`
- `vehicles`
- `property`
- `local_produce`

Display names live in localization/UI code. `property` supports `sale` and `rent`; the existing secondhand create UI remains limited to sale/free/exchange/wanted until its vertical-specific form work is complete.

## Discovery

The read contract supports both list and map surfaces with the same canonical listings:

- vertical/category/trade mode
- comuna/coarse `areaRef`
- viewer-relative `maxDistanceKm`
- search and sort
- optional map viewport
- `surface: list | map`

The client never needs a seller's exact address or raw coordinates. Distance is viewer-relative and can be computed server-side. Mercado map projection passes listing id, vertical and coarse area/Business references to shared Map/Location Core instead of creating a second map implementation.

## Save, compare and transaction

Favorites remain server-backed Mercado state. Comparison is intentionally lightweight client state that stores canonical listing ids only, caps selection at four on mobile, and prevents cross-vertical comparisons.

Messaging continues through Message Core. A coordinating Mercado transaction binds to the durable conversation reference; reservation/completion/cancellation remain Mercado transaction state. Care may be attached later as a shared-core handoff without becoming listing persistence.

## Privacy

Public Mercado payloads must not expose exact street/home address, phone, email, raw latitude/longitude or provider authentication ids. Business linkage is an opaque canonical Business id reference only.
