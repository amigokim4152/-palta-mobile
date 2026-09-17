# Palta Local Business App Product Architecture v1

Date: 2026-09-17
Status: IMPLEMENTATION CONTRACT
Owner: Local Business / Business Gateway track

## Product role

Local Business is a first-class Palta mobile product area. It is not a web directory and not a POS submodule.

```text
Owner describes business
  -> Palta normalizes services
  -> Business becomes locally discoverable
  -> Consumer finds it by need/location/context
  -> Consumer acts
  -> Care/Event tracks persistent follow-up
  -> POS/Booking/Quote consume the same canonical Business and service codes
```

Canonical classification is governed by `PALTA_BUSINESS_CLASSIFICATION_AND_OPERATING_TAXONOMY.md`. Local Business owns taxonomy growth/correction. POS does not create a competing category tree.

## Consumer surface

Primary entry is `Barrio` / Neighborhood using Shared Map Core.

```text
Barrio
  -> Negocios cerca / search by need
  -> synchronized map + results
  -> Business detail
  -> call / WhatsApp / inquiry / quote / reservation / save as capabilities allow
```

General business discovery does not enter Personal Home by default. Home may surface only user-owned, saved, ongoing or explicitly subscribed business state.

## Owner surface

Basic business management starts inside the same Palta app through `Mi negocio`.

```text
Mi negocio
  -> find existing Business on map
  -> claim OR create new
  -> describe what you do/sell in ordinary language
  -> confirm 1-3 Palta service suggestions
  -> set storefront / customer-site / mobile-event / online / mixed
  -> minimum public profile
  -> ownership verification
  -> progressive Business Home
```

Do not make owners browse the internal 21-group taxonomy.

## Map-first registration rules

- Search nearby canonical businesses before creating a new record.
- Already-claimed businesses go to access recovery/verification, never silent reassignment.
- Storefront requires a real map location.
- Customer-site services use service area and must not expose a private home as a fake storefront.
- Mobile/event sellers use current Trading Sessions later; yesterday's location must not become a permanent pin.
- Online-only providers do not need a storefront point.

## Classification rules

Owner words and consumer words are inputs. Canonical ServiceTaxonomy is the bridge.

Resolver evidence order:
1. owner-confirmed explicit service;
2. structured service/catalog evidence;
3. high-confidence normalized owner wording;
4. Chilean alias/intent consistent with context;
5. broad discovery category;
6. weak free text.

Ambiguous terms such as `polarizado`, `masaje`, `estampado`, `aire acondicionado` must retain valid branches until context resolves them. Negative context prevents false matches.

The initial `CHILE_LOCAL_SERVICE_SEED` is starter operational data only. It must grow from real owner registrations, consumer searches, public evidence and reviewed corrections.

## Owner verification boundary

Public sourced facts may exist before claim. Owner-controlled changes require appropriate verification, especially:
- promotions/coupons;
- owner-controlled pricing;
- booking/quote rules;
- POS/payment/fiscal actions;
- staff permissions.

## Dedicated owner apps/modes

Do not create a second owner app for basic registration/profile management. Separate operational clients are justified only for high-frequency shift workflows such as POS, order reception, kitchen display, dispatch or front desk. They remain clients of the same Business identity.

## Cost and infrastructure

- Reuse Shared Map Core and existing local-place data.
- Public high-volume discovery should use edge/cache architecture.
- Deterministic indexed classification/search first; AI only for ambiguity or normalization where useful.
- No paid third-party local-search provider as a default dependency.
- Foundation target remains as close to USD 0/month as practical within existing free tiers.
