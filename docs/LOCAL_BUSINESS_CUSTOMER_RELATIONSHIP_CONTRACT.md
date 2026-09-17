# Palta Local Business — Customer Relationship & Contact Contract

Date: 2026-09-17
Status: CANONICAL_COMPANION
Owner: Local Business / Business Gateway track
Parent: `LOCAL_BUSINESS_APP_PRODUCT_ARCHITECTURE_V1.md`
Related: `LOCAL_BUSINESS_OWNER_PARTNER_DOCTRINE.md`

## 1. Purpose

Palta customer management is not a generic contact database and not an excuse to accumulate personal data. It exists so a business can recognize a legitimate continuing customer relationship, respond better, reduce repeated work and make the next useful interaction easier.

Founder intent inherited from the prior Palta/Base44 work:

```text
local discovery
 -> understand business
 -> contact / visit / quote / booking / order
 -> legitimate relationship or transaction
 -> useful outcome/history
 -> easier repeat interaction
 -> better business operation
 -> better local information
 -> better future discovery
```

The product question is not `how many contacts can the owner collect?`.
It is `what does the owner legitimately need to remember or do so this customer is served better next time?`.

## 2. One person, several relationship layers

Do not collapse all customer meaning into one CRM row.

Palta must keep at least these concepts logically separate:

1. **Discovery relationship** — save/follow/regular-customer participation chosen by the consumer.
2. **Operational customer relationship** — business-scoped information required to fulfill and support actual inquiries, bookings, quotes, orders or services.
3. **Service/transaction history** — legitimate records of what was ordered, booked or completed. Business operational history and the user's private Life/Service history may reference the same event but are not the same dataset.
4. **Marketing permission** — explicit permission to receive promotional/business-development messages. A transaction does not imply marketing consent.
5. **Conversation** — message content and thread context owned by Shared Messaging Core, with retention/access policy appropriate to the conversation type.
6. **Business analytics** — aggregated operational metrics where identifiable personal detail is unnecessary.

These layers may reference the same Person/Business IDs where allowed, but one layer must not silently grant permissions to another.

## 3. Customer identity — Palta membership is optional

A business can have a coherent customer relationship even when the customer is not a Palta member.

Examples:
- Palta user sends an inquiry;
- guest follows a direct order link;
- customer orders after scanning a QR on packaging;
- customer contacts the business through WhatsApp;
- existing customer is entered into a legitimate service/order workflow.

Rules:
- never force Palta signup merely so the business can record a legitimate transaction/customer;
- use a business-scoped customer key/relationship identity where necessary;
- link to a canonical Palta Person only when identity/linkage is legitimate and permitted;
- do not infer that two people are the same merely from weak contact similarity;
- do not expose one business's customer relationship to another business;
- a customer relationship belonging to one business is not a platform-wide marketing profile.

## 4. Minimum useful customer relationship

The baseline should store only what helps the legitimate relationship.

Possible fields/projections include:
- business/customer relationship key;
- optional Palta user reference;
- display name or operational label;
- relationship state such as `new`, `returning`, `regular`;
- source/channel when operationally useful;
- transaction/service counts or last legitimate interaction;
- customer-stated service/product preference where useful;
- next legitimate follow-up date/reason where the service justifies it;
- preferred contact channel chosen/provided for the purpose;
- marketing consent state and evidence separately;
- retention/restriction state.

Do not require unnecessary fields such as full phone number, birthday, demographic profile or personal notes merely because a CRM could store them.

Canonical principle:

> Recognize repeat customers without building an unnecessary dossier.

## 5. Regular customer is not the same as marketing permission

The following must remain distinct:

```text
repeat customer
!= saved/following business
!= regular-customer relationship
!= marketing consent
!= notification permission
!= VIP/commercial segment
```

A person may buy ten times and still decline promotions.
A person may follow a business for updates without having purchased.
A verified transaction may justify operational messages but does not create blanket marketing permission.

The user must remain able to stop promotional updates without breaking necessary order, booking, payment, safety or account communication.

## 6. Contact grammar

Palta separates communication by purpose.

### A. Transactional / operational
Examples:
- quote needs one missing answer;
- booking confirmed/changed;
- order accepted/ready/problem;
- delivery status;
- service result or warranty/follow-up that the user requested or reasonably expects from the service.

These messages follow the active workflow and the minimum required delivery channel.

### B. Followed-business relationship
Examples:
- business post/news;
- owner-verified basic coupon;
- relevant availability/update for users who explicitly follow/subscribe where policy permits.

Follow/save and notification preference remain separately controllable.

### C. Marketing / campaign
Examples:
- win-back promotion;
- segmented offer;
- scheduled campaign;
- cross-sell/upsell campaign.

Requirements:
- explicit applicable marketing consent;
- frequency/pacing limits;
- unsubscribe/withdrawal;
- no repurposing of unrelated sensitive context;
- no bulk contact merely because a person lives nearby or once purchased.

## 7. Channel strategy — internal first where useful, open externally

Palta must not force a business or consumer to abandon existing channels.

Supported direction:

```text
Palta Messaging
WhatsApp
phone
email
Instagram/social link
external marketplace/order channel
other approved connectors
```

Rules:
- Shared Messaging Core owns Palta conversations; Local Business does not create a second message engine;
- WhatsApp and other channels can remain practical external routes;
- receiving a phone/WhatsApp/email for one transaction does not authorize unrelated marketing;
- preferred channel is purpose-specific, not a universal identity claim;
- where an external channel API is unavailable, Palta may prepare/share content or deep-link instead of pretending full synchronization exists;
- channel unification is a convenience layer over canonical Business/customer/action data, not a reason to duplicate truth per channel.

## 8. Owner customer surface — action queue, not CRM bureaucracy

The owner should not open a giant CRM table and decide what to do from scratch.

Default `Mi negocio` customer projection should answer:

```text
Who needs action now?
What happened?
Why does it matter?
What is the smallest useful next action?
```

Examples:
- `2 consultas esperan respuesta`;
- `1 cotización necesita una fecha`;
- `Pedido listo para retiro`;
- `Mantención recomendada este mes` when based on legitimate service history;
- `3 clientes frecuentes siguen tu negocio`;
- `Horario/coupon/news update available to followers`;
- `No customer action needed` when there is nothing useful.

A quiet owner home is correct when no customer needs attention.

## 9. Relationship history should improve service, not create surveillance

Useful history may include:
- last completed order/service;
- products/services actually chosen;
- customer-provided operational preference (for example pickup preference or service specification);
- warranty/follow-up dates;
- unresolved commitment;
- outcome/status.

Avoid storing:
- speculative personality labels;
- unrelated personal-life details;
- sensitive context for advertising;
- full raw conversation text as permanent CRM memory when a minimal structured outcome is enough;
- inferred attributes that the service does not need.

The user's private LifeHistory remains user-owned and must not become the merchant's generic CRM copy.

## 10. AI role — assistant, triage and memory compression

AI should arrive after the relationship contract is correct.

Good AI uses:
- classify incoming inquiry intent;
- summarize a long conversation for the owner;
- draft a concise natural es-CL reply;
- detect the one missing field needed to complete a quote/order/booking;
- suggest the next legitimate follow-up based on service rules;
- detect that repeated manual work may justify an automation capability;
- summarize customer history from structured permitted records;
- suggest an audience only from explicit eligible/consented records;
- translate between owner/operator languages when needed.

AI must not:
- auto-enroll a person into marketing because they purchased;
- infer sensitive traits for targeting;
- send mass promotions without explicit policy/consent;
- fabricate customer preferences or service history;
- retain raw private message bodies indefinitely merely because AI processed them;
- autonomously make consequential promises, prices, refunds or legal/tax commitments outside approved policy;
- silently rewrite canonical customer/service truth from probabilistic inference.

Prefer deterministic rules/events before generative AI for ordinary state changes and consent checks.

## 11. Next-best-action model for the owner

Palta personalization for business owners should use permitted Business/customer/workflow context to rank a small number of useful next actions.

Possible evidence:
- unanswered inquiry age;
- order/booking/quote state;
- legitimate service follow-up date;
- business operating status;
- customer opt-in relationship;
- current inventory/menu/availability where relevant;
- channel repetition/friction;
- current fiscal/administrative task from trusted current rules;
- business's enabled capabilities and actual usage.

Priority order:

```text
urgent customer/operational obligation
 -> broken/stale business truth
 -> customer-requested follow-up
 -> free practical improvement
 -> repeated manual friction
 -> optional automation/capability
 -> commercial upgrade only when it solves observed need
```

Do not rank an upgrade card above an actual customer problem merely because the upgrade can generate revenue for Palta.

## 12. Food/direct-commerce example

A restaurant customer may arrive through:

```text
Uber Eats / external marketplace
Instagram
Google
WhatsApp
Palta discovery
Palta QR/direct link
walk-in
```

Palta should not require the restaurant to stop using those channels.

Desired loop:

```text
external or Palta discovery
 -> legitimate first transaction/contact
 -> excellent fulfillment
 -> QR/direct Palta Business Page invitation
 -> customer may save/follow/opt in
 -> repeat order becomes easier and potentially cheaper
 -> owner sees one coherent operational relationship
 -> external acquisition channel remains available
```

Only data the business/Palta may legitimately use should enter the customer relationship. Do not scrape/import platform customer data in violation of privacy, contract or provider rules.

## 13. Free vs paid customer-management value

The free product must support a real customer relationship rather than intentionally creating pain.

Free/basic direction may include:
- customer-originated inquiries in the basic Palta inbox;
- save/follow/regular-customer relationship;
- basic owner posts and coupons to eligible followers;
- basic operational customer history tied to Palta workflows;
- basic recognition of repeat customers where legitimate;
- essential transactional status communication;
- simple next-action cues.

Paid/advanced value may include, under active commercial policy:
- multi-channel unified inbox where provider APIs permit it;
- advanced segmentation;
- scheduled/automated campaigns;
- win-back/recurring-service automation;
- AI summarization/drafting/triage at higher volume;
- advanced CRM/search/history tools;
- team assignment/permissions;
- channel analytics and conversion attribution;
- workflow automation and integrations.

Paid value should save meaningful owner time, reduce operating cost or produce measurable business value. It must not be created by deliberately degrading the free relationship path.

## 14. Migration from Base44 — preserve semantics, not legacy entities

Useful prior concepts to preserve:
- `BusinessCustomer` business-scoped relationship;
- `BusinessCustomerServiceRecord` separate service-history semantics;
- repeat/regular state;
- next follow-up reason/date;
- preferred channel;
- marketing consent separated from service relationship;
- guests/external customers supported without forced Palta signup;
- `Conversation` context links to business/quote/booking/order;
- operational notifications separated from promotional messages;
- channel connectors retain external tools rather than forcing replacement.

Do **not** migrate as Local Business customer truth:
- `PrivateRelationshipProfile`;
- `PrivateRelationshipMemory`;
- `UserRelationshipContact`.

Those were operator/customer-care CRM concepts and are explicitly separate from canonical person relationships and ordinary business customer management.

Do not copy Base44 IDs or schemas mechanically. Re-express the useful semantics through provider-neutral independent contracts.

## 15. Shared-Core boundaries

Local Business owns:
- business/customer relationship meaning;
- business-facing customer projections;
- service/business follow-up semantics;
- eligible business audience meaning;
- customer-management product behavior.

Shared cores own:
- Person/Identity;
- Messaging conversation/message transport and retention policy;
- Event/Notification delivery;
- Consent/Permission;
- Commerce/Payment/Fiscal truth where applicable;
- Booking/Quote/Order state owned by their respective domains/cores;
- Safety/Moderation;
- Audit.

No second Messaging Core, Consent Core or generic CRM identity system may be created inside Local Business.

## 16. Implementation sequence

Do not build a full CRM before the Local Business acquisition/discovery/relationship loop works.

Recommended sequence:

```text
1. free Business profile + living business truth
2. save/follow + verified-owner posts/coupons
3. context-linked consumer inquiry through Shared Messaging Core
4. minimal business-scoped customer relationship projection
5. quote/booking/order/service outcomes feed relationship history
6. owner next-action queue
7. consent-aware repeat/regular-customer communication
8. AI summary/draft/triage assistance
9. advanced CRM, segmentation and automation only after real usage proves demand
```

Acceptance test:

> A small Chilean owner with no CRM expertise can understand who needs attention and act correctly without learning CRM terminology, while a consumer can interact, return, follow or unsubscribe without losing control of their data or contact preferences.
