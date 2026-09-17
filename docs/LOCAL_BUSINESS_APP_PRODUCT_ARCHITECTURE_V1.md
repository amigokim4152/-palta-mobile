# Palta Local Business App Product Architecture v1

Date: 2026-09-17
Status: IMPLEMENTATION CONTRACT
Owner: Local Business / Business Gateway track

## 1. Product role

Local Business is a first-class Palta mobile product area. It is not a web directory, not a website-sales funnel, and not a POS submodule.

Its job is to connect daily local need with real nearby providers, while giving small businesses a useful digital presence before requiring them to buy software.

```text
Owner describes business
  -> Palta normalizes services
  -> Business becomes locally discoverable
  -> Consumer finds it by need/location/context
  -> Consumer understands the business
  -> Consumer acts
  -> optional modules reduce operating friction
  -> Care/Event can track legitimate follow-up
  -> POS/Booking/Quote reuse the same canonical Business
```

Canonical classification is governed by `PALTA_BUSINESS_CLASSIFICATION_AND_OPERATING_TAXONOMY.md`. Local Business owns taxonomy growth/correction. POS consumes this taxonomy but does not create a competing category tree.

## 2. Founder/product doctrine carried into the independent app

The independent app must preserve these rules from the Palta founder intent, Product Shape, Business Constitution, Gateway Roadmap and Shared Core contracts:

1. **Useful before paid.** A business must be genuinely useful to consumers and owners on the free baseline.
2. **One common public profile.** Industry never creates a separate page/codebase. Industry selects data and optional modules.
3. **Free presence grows the network.** Free businesses improve the local graph, taxonomy, search quality and consumer usefulness.
4. **Paid means less friction / more operating power.** Paid value is workflow, automation, transactions, volume, analytics and operations—not permission to exist.
5. **Capability and entitlement are separate.** A feature may exist technically before a pricing policy decides which plan or transaction lane pays for it.
6. **Payment never buys organic trust.** Paid promotion is a separate, clearly disclosed Promotion/Sponsorship surface.
7. **Local life follows distance.** Consumer discovery crosses comuna boundaries when daily-life distance makes that useful. Administrative eligibility remains jurisdictional.
8. **Simple outside, deep inside.** Taxonomy, policy and shared cores may be complex; owner and consumer screens should expose only the next useful action.
9. **One canonical Business identity.** Jobs, Booking, Quote, POS, Auto, Real Estate and other domains attach to the same `business_id`.
10. **Do not make the founder the operator.** Ordinary onboarding, correction, classification and module suggestions should be self-service/rule-driven, with human review for exceptions.
11. **Business truth must stay alive.** A nearby listing that is closed, seasonal, moved or stale is not useful merely because its page still exists.
12. **Relationship compounds value.** Discovery should be able to become a voluntary customer-business relationship: save/follow/regular customer, useful updates, repeat action and better service history.

## 3. Free Business Core — common and usable by itself

The free baseline is not a crippled trial and not a temporary preview. It is the common Palta Business Profile.

Every eligible business can use the same data-driven profile grammar:

```text
Business Profile — FREE CORE
├ identity: name + canonical category/services
├ place: storefront location OR service area / current valid trading context
├ photos
├ short description
├ opening hours / current operating status when applicable
├ public contact: WhatsApp / phone / useful external link
├ basic service/product description
├ posts / business news
├ basic coupon/benefit publishing for a verified owner
├ organic map + search discoverability
├ public indexable web projection from the same canonical data
├ owner claim / correction / basic management
└ consumer save/follow + direct practical contact where available
```

Notes:
- `basic service/product description` is free profile information; a structured menu, advanced catalog, price-management workflow or inventory-linked catalog may be an optional module.
- A customer-site/mobile/online provider is not forced to expose a private home as a storefront.
- Free status is not a negative trust signal and must not reduce organic relevance merely because the business has not purchased a module.
- Basic coupons are owner-controlled commercial claims, so the owner relationship must be verified before publication. Verification is a trust gate, not a payment gate.
- The public web projection and app profile are two views of the same canonical Business, not separately maintained pages.

## 4. Progressive capability ladder

A business starts with the free profile and adds capabilities only when they solve a real operating problem.

```text
FREE PRESENCE
  basic profile
  map/search/web discovery
  owner management
  practical contact
  basic posts/coupons
  save/follow relationship
       ↓
STRUCTURED CUSTOMER ACTION
  richer service/catalog tools
  messaging
  quote / booking
       ↓
TRANSACTION & FULFILLMENT
  orders / pickup / delivery / payment
  customer follow-up
       ↓
BUSINESS OPERATIONS
  POS / inventory / CRM / staff / fiscal
       ↓
AUTOMATION & SCALE
  analytics / segmentation / scheduled campaigns
  workflow automation / team tools / integrations
```

The ladder is progressive, not mandatory. A gasfiter who only wants a free profile and WhatsApp contact can remain useful without adopting POS. A shop that needs inventory and POS can go deeper without re-registering the business.

The paid-value test is: **does this capability save the owner meaningful time, reduce operating friction, create measurable additional value, or support a materially deeper transaction/operation?** Do not manufacture pain in the free product merely to create an upgrade.

## 5. Commercial architecture

Local Business does not invent its own billing engine.

Commercial behavior composes the shared platform grammar:

```text
Capability
  != Entitlement
  != PricingPolicy
  != Subscription
  != Payment
  != Promotion/Sponsorship
```

Approved commercial lanes may later include:
- free baseline;
- paid capability / subscription;
- Palta-origin completed transaction/success fee where an active policy explicitly permits it;
- external affiliate/referral revenue;
- fulfillment/logistics fee;
- paid Promotion/Sponsorship.

Rules:
- exact prices, limits, commissions and plan packaging come only from active canonical commercial policy;
- Local Business UI must not hard-code remembered prices;
- a technically enabled capability is not automatically free or paid;
- paid exposure never rewrites organic rank, verification or trust;
- paid promotion must be visibly distinguishable (`Promocionado` or equivalent es-CL disclosure);
- no suitable promotion means render no ad rather than fill a slot with irrelevant advertising;
- returning/direct-customer economics and Palta-origin new-customer economics may differ, but only through an approved `PricingPolicy`; Local Business must not invent the percentage.

## 6. Consumer surface

Primary entry is `Barrio` / Neighborhood using Shared Map Core.

```text
Barrio
  -> Negocios cerca / search by need
  -> synchronized map + results
  -> common Business Profile
  -> free contact actions + enabled optional actions
```

Consumer mental model:

```text
open
 -> say/search what I need
 -> see nearby relevant businesses
 -> know whether they are actually usable now
 -> understand quickly
 -> act
```

General business discovery does not enter Personal Home by default. Home may surface only user-owned, saved, ongoing, explicitly followed/subscribed, or otherwise legitimately personal business state.

## 7. Public profile rendering rule

There is one common public Business Profile renderer.

Do **not** implement:

```text
SalonPage
GasfiterPage
RestaurantPage
AcademyPage
...
```

Implement:

```text
Common Business Profile
  + canonical business data
  + service/category projection
  + enabled capability modules
  + verified current operating state
```

Examples:
- salon: free profile + optional booking / structured price list;
- restaurant: free profile + optional menu / order / QR / POS;
- academy: free profile + optional booking / education module;
- service provider: free profile + optional quote / job workflow;
- retailer: free profile + optional catalog / order / POS / inventory.

The visual grammar stays consistent. Optional modules add actions/sections; they do not replace the base page.

## 8. Owner surface

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
  -> publish useful free presence
  -> improve profile gradually
  -> keep today's operating truth current
  -> activate optional modules only when useful
```

Do not make owners browse the internal 21-group taxonomy.

Owner mental model:

```text
register/claim
 -> appear correctly
 -> keep information current
 -> receive useful local demand
 -> turn some visitors into regular customers
 -> add a tool when that tool makes work easier
```

The owner home should not be a permanent wall of upsell cards. Module suggestions should be contextual to actual business operation or observed need.

## 9. Lightweight registration and progressive enrichment

Initial registration should ask only enough to create or claim a useful, non-duplicate Business:
- business name;
- storefront location or service area;
- main activity/service description;
- one usable public contact method;
- ownership/claim evidence as appropriate.

Target: an ordinary owner should be able to complete the basic path in roughly 1–2 minutes.

Ask later, progressively, for:
- photos;
- fuller description;
- regular hours;
- special/seasonal hours;
- detailed services/products;
- prices/catalog information;
- team;
- booking/quote configuration;
- offers;
- hiring;
- POS/inventory/fiscal tools.

Progressive enrichment must improve the same canonical Business record rather than creating another profile.

## 10. Map-first registration rules

- Search nearby canonical businesses before creating a new record.
- Already-claimed businesses go to access recovery/verification, never silent reassignment.
- Storefront requires a real map location.
- Customer-site services use service area and must not expose a private home as a fake storefront.
- Mobile/event sellers use current Trading Sessions later; yesterday's location must not become a permanent pin.
- Online-only providers do not need a storefront point.

## 11. Classification and self-correction rules

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

When an owner registration exposes a missing service or alias:

```text
unknown expression
 -> attempt existing canonical match
 -> alias gap? add reviewed alias
 -> genuinely new service? taxonomy candidate
 -> owner confirmation/evidence
 -> promote to canonical taxonomy when justified
 -> re-use for future registrations and searches
```

Do not solve a shared taxonomy gap by adding a one-off tag only to one business.

## 12. Owner verification boundary

Verification, free/paid plan and capability entitlement are different states.

Public sourced facts may exist before claim. Owner-controlled changes require appropriate verification, especially:
- promotions/coupons;
- owner-controlled pricing;
- booking/quote rules;
- POS/payment/fiscal actions;
- staff permissions.

Verification must not be used as a disguised payment gate.

## 13. Living Business Truth — opening state, seasonality and freshness

A Local Business record is not useful if it has a correct name but stale operating reality. Palta must model **stable identity** separately from **dynamic operating truth**.

Minimum public operating states:

```text
OPEN_NOW
CLOSED_NOW
CLOSED_TODAY
TEMPORARILY_CLOSED
SEASONAL_CLOSED
PAUSED
PERMANENTLY_CLOSED
UNKNOWN_OR_STALE
```

These states are not one overloaded boolean. Palta combines, in precedence order where applicable:

```text
permanent lifecycle
  + owner/trusted temporary override
  + seasonal window
  + special-date hours
  + regular weekly schedule
  + current Trading Session for temporary/mobile sellers
  + freshness/confidence evidence
  -> consumer-facing current state
```

Rules:
- a verified owner's explicit `closed today`, `temporary close`, `season closed` or `reopened` update is high-value current evidence;
- special/seasonal state can override normal weekly hours without rewriting the base schedule;
- expired temporary overrides must fall back to the underlying schedule rather than remain forever;
- a permanently closed business is removed from ordinary active discovery but its identity/history may remain for dedupe, correction and legitimate history;
- stale data must not be presented as confidently `open now` merely because an old schedule says so;
- user correction reports may create a recheck signal, but one unverified report does not silently rewrite canonical business truth;
- owner actions such as profile update, order acceptance, POS activity or current post may contribute freshness evidence only under explicit domain rules; incidental activity must not fabricate opening status;
- show `last confirmed` or an understandable freshness cue when it materially helps trust.

Owner UX should make current truth easier than editing a schedule form:

```text
[Abierto ahora]
[Cerrado por hoy]
[Cerrado temporalmente]
[Cierre de temporada]
[Editar horario]
```

The design goal is that keeping Palta accurate is less work than leaving inaccurate information online.

## 14. Travel / explored-area behavior — the Algarrobo test

A user who travels from Santiago to Algarrobo, Valparaíso, Pucón or another area should not receive a directory frozen to the saved home comuna.

Canonical behavior:

```text
current/explored location
  -> nearby businesses by actual distance/service area
  -> current operating state
  -> current seasonal/trading-session validity
  -> service relevance
  -> freshness/trust
  -> distance
```

The user's saved home/life area does not change merely because they are traveling.

Acceptance scenario:
- user arrives in Algarrobo in low season;
- opens `Negocios cerca`;
- businesses currently open rank ahead of closed/uncertain ones when relevance is otherwise comparable;
- a seasonal restaurant can clearly show `Cerrado por temporada` rather than an old weekly schedule;
- a restaurant that opens only on the weekend can show the next useful opening information;
- a mobile/temporary seller appears only when a valid Trading Session establishes where/when it is operating;
- stale/unknown records remain distinguishable from confirmed current availability.

Palta should optimize for **“what can I actually use here now?”**, not merely “what businesses have ever existed here?”.

## 15. Customer relationship — save, follow, regular customer and useful contact

Local Business should let one-time discovery become a voluntary persistent relationship without turning the app into spam.

Canonical loop:

```text
find business
 -> contact/visit/order/use
 -> save/follow/become a regular customer voluntarily
 -> receive allowed useful updates
 -> repeat action is easier
 -> legitimate relationship/history improves future service
```

Free verified-owner tools may include:
- basic post/news publishing;
- basic coupon/benefit publishing;
- followers/regular-customer audience created by user opt-in;
- simple follower update delivery subject to user notification preference and platform frequency limits.

Paid/advanced value may later include, subject to active entitlement/pricing policy:
- scheduled campaigns;
- audience segmentation;
- automated repeat-visit or win-back flows;
- booking-gap or low-stock campaign automation;
- campaign conversion analytics;
- CRM depth and team workflows.

Rules:
- the owner cannot broadcast push notifications to arbitrary nearby users merely because they are geographically eligible;
- follow/save/regular-customer state and marketing notification consent are related but not identical; notification preference remains user-controlled;
- Palta applies frequency/pacing controls so one aggressive merchant cannot damage the whole notification channel;
- organic Local discovery remains separate from follower messaging and paid Promotion/Sponsorship.

## 16. Food / restaurant direct-commerce strategy

Food is a high-value example of the full Palta loop because discovery, current opening state, inventory/menu availability, repeat purchase, pickup and delivery all change quickly.

Founder intent preserved from the prior Business/Food work:

> External delivery marketplaces may remain useful new-customer acquisition channels. Palta should make it increasingly attractive for a restaurant's existing/returning customers and Palta-origin local customers to use the restaurant's own Palta relationship for repeat ordering, pickup and fulfillment.

Do not model this as `replace Uber Eats immediately`.

Model it as channel choice:

```text
NEW CUSTOMER DISCOVERY
  Palta organic local discovery
  clearly labeled Palta promotion
  external delivery marketplace
  Google/web discovery
  owner social/direct link
        ↓
CANONICAL BUSINESS + CUSTOMER ACTION
        ↓
FULFILLMENT CHOICE
  dine-in
  counter
  pickup/takeaway
  merchant delivery
  external delivery partner
  later Palta-coordinated delivery where operationally justified
        ↓
RELATIONSHIP
  save/follow/regular customer
  repeat order
  useful updates/coupons
```

Economic rules:
- do not charge marketplace-scale acquisition economics merely because a known/returning customer uses Palta again;
- owner-direct traffic and returning-customer traffic may use a different commercial lane from a Palta-origin new customer;
- Palta-origin completed orders may carry a fair configurable success/transaction fee only under an approved policy accepted in advance;
- pickup, merchant-fulfilled delivery and third-party fulfillment must remain economically distinct because their cost structures differ;
- payment-processing cost, delivery/fulfillment cost and Palta platform economics remain separately auditable;
- do not invent the final fee now; benchmark current Chile alternatives and activate only through `PricingPolicy`;
- lower merchant cost must not be achieved by hiding equivalent cost from the consumer or underpaying delivery/fulfillment partners.

Operational state for restaurants should be composable, for example:

```text
business open?
  + lunch ordering open?
  + pickup open?
  + delivery open?
  + item/menu availability
  + temporary/seasonal closure
  -> actions that are actually usable now
```

A restaurant can therefore remain visible while one channel is unavailable: e.g. dining open but delivery closed, or business closed today but future booking available.

## 17. Local Business network flywheel

Palta's defensibility should come from useful participation and accumulated operational truth, not artificial lock-in.

```text
accurate local business truth
 -> consumers trust/use Palta
 -> businesses receive qualified demand
 -> owners keep status/services current
 -> consumers save/follow/repeat
 -> more real operating evidence
 -> better discovery/search/freshness
 -> stronger merchant value
 -> optional paid tools become worthwhile
 -> more activity returns to the same canonical Business
```

The desired outcome is that leaving Palta feels economically inconvenient because the business would lose useful customer relationships, current operational context and integrated tools—not because Palta traps the owner's data or blocks portability. Canonical business data must remain exportable/migration-safe under platform rules.

## 18. Promotion / local advertising

Local advertising is a later revenue surface built on the existing Promotion/Sponsorship Core, not a second Ads Core.

Placement decision stays inside Palta and protects the consumer experience:

```text
surface allows promotion?
 -> geo/service-area eligible?
 -> context relevant?
 -> active campaign/budget?
 -> frequency/pacing okay?
 -> enough organic content?
 -> render clearly labeled sponsored card
otherwise
 -> render nothing
```

Advertising belongs mainly in Local/Business/Market/vertical discovery contexts, not generic Personal Home discovery.

A business can buy additional clearly disclosed reach. It cannot buy factual authority, verification, trust or organic ranking.

## 19. Dedicated owner apps/modes

Do not create a second owner app for basic registration/profile management.

Separate operational clients are justified only for high-frequency shift workflows such as:
- POS;
- live order reception;
- kitchen display;
- dispatch;
- front desk / queue.

They remain clients of the same Business identity and shared capabilities.

## 20. Historical-plan reconciliation

Older Business notes contain useful research but some product assumptions are superseded.

Current interpretation:
- **website-first outbound sales** is superseded by map/search + owner registration/claim + real local demand;
- **founder-built pages** are superseded by owner self-registration and controlled Palta/public-data seeding;
- older suggestions that core photos/details should require a paid managed page do not override the current free common Business Core;
- older wording such as "paid business gets better exposure" must be interpreted only as separately disclosed Promotion/Sponsorship, never better organic rank;
- optional custom domain/external presentation remains an extension of the same Business data, not a second independently maintained website;
- older food pilot prices/free-period promises are research/history unless represented by an active approved commercial policy;
- prior direct-order experiments are useful workflow evidence, but Food remains a capability composition on the same Local Business identity rather than a separate duplicate business system.

## 21. Cost and infrastructure

- Reuse Shared Map Core and existing local-place data.
- Public high-volume discovery should use edge/cache architecture.
- Deterministic indexed classification/search first; AI only for ambiguity or normalization where useful.
- Current operating-state projection should be deterministic from canonical schedule/override/session/freshness facts; do not call AI to decide whether a restaurant is open.
- No paid third-party local-search provider as a default dependency.
- Foundation target remains as close to USD 0/month as practical within existing free tiers.
- Do not introduce a paid provider merely to implement the free business profile.

## 22. Current implementation correction rules

For the independent app:
- consumer Business detail must never assume `quote`, `booking`, `order`, `coupon`, `pricing`, POS or another optional module merely because the business exists;
- free/contact actions are derived from actual public data;
- optional actions render only from the business's enabled capability projection;
- commercial entitlement is checked separately when an action is entered or configured;
- the common Business Profile remains usable when no optional module is enabled;
- module absence must not remove the business from organic map/search discovery;
- Local discovery must not equate an old schedule with `open now` when freshness is unknown;
- permanent closure is a lifecycle fact, temporary/seasonal closure is an operating fact, and channel availability such as pickup/delivery is a capability/operational fact; do not collapse them into one boolean;
- user travel/exploration may change Local discovery context immediately without rewriting the user's saved home/life area;
- Food/direct-order work must reuse Local Business + Order/Fulfillment + Payment + optional delivery contracts rather than create a second food-business identity.
