# Local Business · Karrot benchmark 2026

Status: IMPLEMENTATION INPUT
Reviewed: 2026-09-18

Palta uses Karrot/당근 as a benchmark for interaction clarity and local-business usefulness. It does not copy Karrot's brand identity, proprietary visual design or screen composition one-for-one.

## Current benchmark signals

Official Karrot/Daangn materials reviewed in 2026 show a business profile acting as the local merchant's central surface rather than a static directory record:

- Business Profile is free to start and connects local discovery with posts, chat, coupons and regular-customer relationships.
- Industry-specific tools extend the same profile into quote requests, booking and pickup ordering.
- Local-map/search presentation uses compact place cards close to the map, with enough information to decide whether to open the business profile.
- The 2026 owner-home redesign puts visitor/regular-customer signals, discovery/search signals and practical operating suggestions into one owner surface.
- The 2026 Toss Place partnership extends merchant information, menu, order reviews, ordering, POS handling and payment around the Business Profile rather than creating a separate merchant identity.

Primary official references:
- https://business.daangn.com/business-profile/about
- https://about.daangn.com/service/
- https://about.daangn.com/company/pr/archive/당근-비즈프로필-관리자-홈-전면-개편으로-단골관리-더-쉬워진다/
- https://about.daangn.com/company/pr/archive/당근-전국-40만-토스-가맹점-품는다홍보주문결제-하나로/
- https://business.daangn.com/edu/vod/bfcffa60-fb7c-4543-975e-dafec77a5506/비즈프로필-만드는-법

## What Palta should learn

### 1. A nearby-business result must be understandable before opening it

The result card is not a database row. In about three seconds it should answer:
- what business this is;
- whether it can be used now;
- distance or service area;
- one or two useful service labels;
- at most one current reason to look now.

Palta implementation: `LocalResultCard` supports a real image when available, deterministic fallback when not, current operating truth, distance/service-area context, service labels and one highlight.

### 2. Map and list are one experience

Do not create a map product and a directory product. They are two projections of the same result set and selected canonical Business.

Palta implementation:
- one `DiscoveryState`;
- one selected Business ID;
- pin selection opens an in-context result preview;
- cluster tap expands smoothly;
- result sheet overlays instead of resizing the map;
- explicit `Buscar en esta zona` after pan;
- detail return restores search/filter/camera context.

### 3. The Business Profile is the center of the relationship

The first viewport must answer:
1. What/where is this business?
2. Can I use it now?
3. What can I do next?

Supporting content follows: services, benefit, verified-use reviews, useful updates, hours/service area, external channels and corrections.

The user should not have to visit separate profile, coupon, review and quote products to understand one business.

### 4. Owner Home should help run the business, not advertise Palta modules

Karrot's owner-home direction validates putting practical business signals and recommendations together. Palta should go further by keeping the screen quiet when nothing needs attention.

Palta rules:
- current operating truth first;
- real customer/verification/correction work before growth suggestions;
- free/manual fix before paid automation;
- no fabricated visitors, search terms, leads, revenue or conversion data;
- paid automation only after Palta observes a repeated burden it can actually reduce.

### 5. Transactions should strengthen the same Business identity

Quotes, bookings, orders, POS and payment must attach to the same canonical Business. They must not create separate merchant identities.

Palta translation:
- Local Business owns discovery/profile semantics;
- Quote/Booking/Order own their specialized transaction semantics;
- POS/Commerce owns operational commerce;
- Shared Care tracks wait/result/follow-up;
- Shared Messaging owns conversation transport;
- the canonical Business ID ties them together.

## Where Palta must be better

Karrot is a benchmark, not the ceiling.

Palta should exceed the benchmark in these areas:

1. **Operational truth** — `open_now`, `closed_today`, `seasonal_closed`, `temporarily_closed`, stale/unknown hours and next-open projection are first-class, not decorative text.
2. **Service-area businesses** — plumbers, cleaners, tutors and mobile providers remain discoverable without exposing a private home point.
3. **Verified-use reviews** — review eligibility can be tied to confirmed Palta service/booking/order/quote evidence instead of making anonymous star accumulation the core trust model.
4. **Continuity after action** — quote/booking/order/inquiry can continue through Care/Home rather than ending at a contact button.
5. **External-channel pragmatism** — a free profile can link to Instagram, Facebook, TikTok, Google, WhatsApp and an existing site; paid integration is for automation, not permission to be visible.
6. **Merchant partnership** — owner guidance follows observation → why it matters → one practical action and should not feel like a constant upsell wall.
7. **Chile reality** — WhatsApp, service areas, seasonality, informal/small merchants and mixed digital maturity must be treated as normal product cases.

## Screen reference

The implementation reference is available at:

`/dev/local-business-samples`

It intentionally reuses production components for:
- search result samples;
- the first viewport of a Business Profile;
- the owner Partner Home sample.

The sample must not become a disconnected mock design. CI should fail if production components no longer satisfy the reference contract.
