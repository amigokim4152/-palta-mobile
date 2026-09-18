# Palta Autos — Seller & Business Model V1

Date: 2026-09-18
Status: CANONICAL_COMPANION / PRE-PERSISTENCE
Owner: Autos vertical
Related: `REAL_ESTATE_PRODUCT_ARCHITECTURE_V1.md`, `LOCAL_BUSINESS_OWNER_PARTNER_DOCTRINE.md`, `PALTA_SERVICE_EXCHANGE_BUSINESS_MODEL_V1.md`, `DATA_EVENT_INDEPENDENCE_V3_2.md`, `OPERATOR_RELATIONSHIP_MESSAGING_CONTRACT.md`, security/privacy contracts.

## 1. Decision

`Autos` is an independent Palta vertical, discoverable from `Negocios`, but `Negocios` does not own vehicle inventory, listings, dealer offers or sale lifecycle.

Autos serves two distinct customer contexts:

- **Person / private owner**: Palta is a simple consumer service for selling, buying and then living with a vehicle.
- **Automotive Business**: Palta is an operating, inventory, lead, trust and acquisition layer that helps the business run better and sell/buy vehicles with less fragmented work.

Palta does **not** begin as a principal used-car retailer that must buy and carry inventory. K Car is useful as a trust, inspection, online-purchase and after-sales benchmark, but Palta V1 should not assume K Car's inventory risk or retailer liability.

The intended product blend is closer to:

- direct owner sale and local trust from Karrot/Daangn;
- professional seller tooling, diagnosis/trust and seller-to-dealer offer competition seen in Encar/KB ChaChaCha;
- Chile-specific automotora workflow and channel realities;
- Palta's own canonical Business, Map, Messaging, Care/Event and Service Exchange cores.

## 2. Existing Palta doctrine applied to Autos

### Value before monetization

Business owners are Palta users in a business context, not merely leads to upsell. The professional Autos product must first reduce work, improve discoverability, strengthen trust or create useful transactions. Paid value should automate or consolidate meaningful work rather than intentionally cripple the free baseline.

### One canonical Business

Automotoras, dealers, brokers and consignment businesses use the existing canonical `Business` identity from Negocios.

Autos must not create a second dealer identity.

```text
Negocios Business
  -> Automotive capabilities
  -> Autos inventory/storefront
  -> listing publisher / broker relationship
  -> leads / offers / follow-up
```

### Paid promotion is not trust

Verification, owner relationship, representation authority, inspection and vehicle facts are evidence/trust states. They are never purchased.

Sponsored exposure may exist, clearly labeled and separate from organic relevance or competitive offer routing.

### Shared cores remain shared

Autos references rather than recreates:

- canonical Business
- Map / Place / Neighborhood
- Messaging Core
- Event/Care Core
- Service Exchange / provider routing
- Payment/Commerce when appropriate
- Partner Core

## 3. Public sale modes

The current simplistic `owner_direct | dealer` distinction is insufficient for persistence.

A public vehicle listing must use one explicit sale mode:

### `owner_direct`

A private person is selling a vehicle they are authorized to sell.

Public label:

`Dueño directo`

Requirements:
- private person publisher;
- ownership or legitimate selling authority may be verified privately where lawful and technically available;
- private identity evidence is not exposed publicly;
- buyer inquiry goes to the private seller's authorized conversation.

### `dealer_inventory`

A verified/eligible automotive Business is selling a vehicle as part of its own commercial inventory.

Public label:

`Automotora`

Requirements:
- publisher is a canonical Business;
- listing links back to Business Profile;
- Business inventory operational state remains distinct from the public listing snapshot;
- staff operate through role capabilities rather than shared credentials.

### `brokered_consignment`

A professional Business is managing or marketing a sale on behalf of a separate owner.

Public label:

`Venta por consignación` or another approved es-CL label.

Requirements:
- publisher is a canonical Business;
- a private owner/authorized party remains distinct from the broker;
- Palta holds a private representation/consignment authorization state;
- the public listing must not imply that the broker is the legal owner merely because it publishes the listing;
- buyer inquiry routes to the authorized broker Business according to the representation scope.

These are **sale relationships**, not account types.

## 4. Private-person lane

The basic private-person experience is a life service.

V1 should support:

1. identify the vehicle;
2. confirm minimum seller authority/ownership evidence where possible;
3. create a clear listing with photos, mileage, price, location context and material facts;
4. receive inquiries without publicly exposing unnecessary personal contact details;
5. save/compare vehicles as a buyer;
6. optionally request offers from eligible automotoras instead of, or alongside, a direct listing;
7. use a safe transaction/transfer checklist;
8. mark reservation/sale outcome;
9. hand the resulting vehicle into the buyer's `Mis autos` lifecycle when appropriate;
10. continue with documents, insurance, maintenance, repair, inspection and reminders through shared Palta cores.

Basic personal publication should not be designed as a professional ad product.

Professional-volume behavior or repeated commercial patterns should be reviewed/classified rather than allowing a professional seller to masquerade as many private sellers.

## 5. Automotive Business lane

The professional product is **not merely paid listing slots**.

### Free / baseline value

Subject to later pricing policy, the baseline should be meaningfully useful:

- canonical Business Profile;
- automotive services/category truth;
- verified-owner/business claim workflow;
- manually manageable inventory presence;
- basic listing quality/freshness checks;
- public channel links;
- basic vehicle inquiries/leads;
- basic sold/paused state;
- QR/direct link to Business or inventory surface;
- clear linkage from Autos listing to Business Profile.

Numeric inventory limits and prices are a PricingPolicy decision, not hard-coded architecture.

### Advanced / paid value

Paid value is justified when Palta does more operating work:

- high-volume inventory management;
- bulk CSV/feed/API ingestion;
- inventory synchronization from external systems;
- staff/team roles;
- consolidated lead inbox;
- lead source, response-time and conversion analytics;
- automated stale-listing/freshness workflows;
- pricing/market comparison support;
- acquisition workflow for buying vehicles from private owners;
- trade-in workflow;
- consignment/representation workflow;
- inspection/history publishing workflow;
- finance/insurance/transfer partner handoffs;
- external channel read/publish/operate adapters when authorized;
- campaign/visibility products clearly separated from organic trust/routing.

The owner should pay because Palta saves time, reduces fragmentation, improves operations or creates measurable transactions.

## 6. Private seller -> automotora offers

Palta should support two clearly different seller intents:

```text
Vender directo
OR
Recibir ofertas de automotoras
```

The user may later be allowed to use both if policy permits.

`Recibir ofertas de automotoras` is not a public listing subtype. It is a bounded competitive acquisition workflow.

Flow:

```text
private owner
 -> vehicle facts + sale intent
 -> eligibility/verification
 -> bounded provider routing
 -> eligible verified automotive Businesses
 -> offers/bids
 -> owner compares amount + Business trust/service context
 -> owner chooses whether to engage
 -> contact/inspection/handoff
 -> accepted / declined / expired outcome
```

Rules:
- paid sponsorship must not silently enter or reorder the organic offer pool;
- routing may use category/capability, service area, verification, availability, response quality and exposure rotation;
- personal phone/email/exact address is withheld until needed and authorized;
- Business compensation model must be disclosed according to PricingPolicy;
- an offer is not a public listing;
- accepting an offer does not automatically imply legal transfer completion.

This follows Palta Service Exchange competition principles while remaining an Autos-owned transaction workflow.

## 7. Broker / consignment relationship

A broker may sell for a private owner only through an explicit representation relationship.

Conceptual model:

```text
Vehicle
  -> private owner claim / seller authority (private)
  -> representation authorization (private)
       -> canonical Business
            -> brokered VehicleListing (public projection)
            -> buyer leads / inquiries
```

Representation must include at least:
- represented vehicle;
- granting party;
- Business acting as representative;
- scope/status;
- start/end or revocation state where relevant;
- evidence reference/provenance as required by policy.

The underlying authorization/evidence is confidential/private and is never copied into the public listing.

## 8. Trust model

Trust dimensions remain separate:

- account identity verified;
- Business verified;
- Vehicle identity/facts verified;
- seller authority / owner relationship verified;
- broker representation verified;
- inspection/diagnosis available;
- history/report available;
- transaction outcome evidence.

A UI may summarize these dimensions, but must not collapse them into a paid badge.

Chile-specific vehicle and owner checks must use lawful sources and source/freshness provenance. A user assertion, system import, trusted source and Business assertion are not equivalent evidence.

## 9. Messaging

Autos must not build a second chat system.

A vehicle inquiry creates/uses the shared canonical Messaging Core with Autos context such as:

- listing id;
- vehicle id;
- seller/publisher actor;
- canonical Business id when relevant;
- inquiry purpose;
- permitted offer/inspection/appointment context.

Public listing discovery must not require exposing the seller's raw phone, email or exact private address.

WhatsApp/external contact may remain an optional authorized channel where useful, consistent with the open-channel doctrine.

## 10. Map and location privacy

Vehicle listings use shared Map/Place context.

For ordinary discovery, neighborhood/comuna-level context is normally sufficient. Exact private-owner vehicle/home location must not be retained or shown merely because it was available.

A meeting/inspection may use a separately authorized meeting location without rewriting the listing's public location truth.

## 11. Lifecycle and Event/Care

A listing's current state and its event history are different concerns.

Examples of Autos events:

- listing published;
- listing paused;
- price changed;
- inquiry received;
- inspection scheduled;
- offer submitted;
- offer accepted/declined/expired;
- vehicle reserved;
- listing sold/closed;
- transfer preparation started/completed;
- vehicle added to `Mis autos`;
- SOAP / Permiso / Revisión / maintenance follow-up created.

Event identity and payload are Palta contracts, not Supabase/Cloudflare/provider contracts.

## 12. Pre-persistence domain boundaries

Do not implement one giant `vehicle_listings` record containing ownership, public ad data, broker authority, leads and history.

Persistence should eventually reflect separate concepts such as:

- canonical `Vehicle`;
- private seller/owner authority relationship;
- public `VehicleListing` snapshot/lifecycle;
- listing publisher relationship;
- private representation/consignment authorization;
- Business inventory operational state;
- private-seller acquisition request;
- Business offer/bid;
- buyer lead/inquiry;
- verification facts/evidence/provenance;
- vehicle/listing lifecycle events;
- account-scoped saved/favorite relationship.

Exact database tables are intentionally **not decided in this document**. First freeze the domain contracts and authorization boundaries, then derive storage.

## 13. Access boundary for future persistence

When Supabase is used:

- public listing projections may be client-readable;
- private owner/authority/representation evidence is never broadly client-readable;
- account-private data is self-scoped;
- Business operational data is role/capability scoped;
- mutation and side-effecting workflows go through Palta API authorization where required;
- `authenticated` alone is never sufficient authorization;
- service-role credentials never ship to mobile/public clients.

## 14. Benchmark interpretation

### Karrot/Daangn
Use as a benchmark for:
- direct person-to-person sale;
- owner verification;
- local discovery;
- simple posting and browsing.

### K Car
Use as a benchmark for:
- inspection/trust presentation;
- end-to-end purchase/sale convenience;
- warranty/after-sales concepts.

Do not copy its principal-inventory retailer model into Palta V1.

### Encar / KB ChaChaCha
Use as benchmarks for:
- professional seller tools;
- dealer inventory;
- inspection/diagnosis layers;
- private seller -> dealer competitive offers;
- dealer quality/response context.

### Chileautos / Yapo
Use as local market benchmarks for:
- Chilean vehicle publication fields and quality controls;
- automotora/professional-account expectations;
- paid publication/premium visibility market norms;
- inventory-pack/integration needs.

Palta differentiation should not be merely another paid classified-ad slot. The defensible layer is the combination of canonical Business, inventory operations, local discovery, trust, leads, fair acquisition routing, Messaging, Service Exchange, Care/Event lifecycle and broader Palta context.

## 15. Implementation order from here

1. freeze seller/sale relationship contracts;
2. update demo labels and flows to distinguish owner direct / dealer inventory / consignment;
3. implement private seller `Vender directo` vs `Recibir ofertas de automotoras` choice;
4. implement Business acquisition/offer demo;
5. implement consignment authorization demo/contract;
6. connect inquiries to shared Messaging contract boundary;
7. define verification/provenance projection;
8. only then derive persistence/API contracts;
9. only after persistence contracts, implement Supabase migrations/RLS/API side effects;
10. pricing/entitlement is layered afterward without changing seller truth.

Canonical sentence:

> **For a person, Palta Autos makes selling and owning a vehicle easier. For an automotive Business, Palta becomes the operating and customer-acquisition layer that reduces work and creates useful transactions without buying trust or distorting fair competition.**
