# Palta Local Business — Owner Partner & Personalization Doctrine

Date: 2026-09-17
Status: CANONICAL_COMPANION
Owner: Local Business / Business Gateway track
Parent: `LOCAL_BUSINESS_APP_PRODUCT_ARCHITECTURE_V1.md`

## 1. Purpose

Palta must not treat a business owner as a lead to upsell. The owner is a Palta user with a business context.

The same personalization principle used for consumers applies to business owners:

```text
consumer context -> useful life information comes to the person
business context -> useful operating guidance comes to the owner
```

The owner should not need to search through a generic library of business advice. Palta should understand the canonical Business, its category/services, location, seasonality, operating state, enabled capabilities, customer relationship, current channels and observed friction, and then surface only the next useful action.

The product question is not:

> What feature can Palta sell this owner?

It is:

> What would make this business easier to run, easier to discover, cheaper to operate or better able to serve customers right now?

Monetization follows value created. It must not reverse this order.

## 2. Owner Home is a personalized business partner

`Mi negocio` should become a Business Partner Home rather than a control panel full of modules.

A useful owner home may surface, when relevant:

```text
TODAY
- current open/closed state
- unusual schedule or seasonal exception
- orders/bookings/quotes requiring action
- stock/service availability issue

KEEP THE BUSINESS DISCOVERABLE
- opening hours need reconfirmation
- phone/WhatsApp no longer works
- profile photo or service information is incomplete
- a common customer search does not match the profile yet
- Google/social link can be connected

HELP SELL BETTER
- basic coupon for verified owner
- simple post/news suggestion
- repeat-customer opportunity
- direct-order / pickup opportunity
- QR/link for packaging, counter, receipt or storefront

RUN MORE EASILY
- booking/quote/order/POS/inventory capability only when the workflow justifies it
- channel consolidation when the owner is manually repeating the same work
- staff/team permissions when multiple people operate the business

STAY ON TOP OF OBLIGATIONS
- tax/fiscal/admin deadlines or preparation only from current Chile rules and trusted sources
- clear distinction between educational guidance, workflow assistance and regulated professional advice
- escalation to accountant/legal/professional help when required
```

Do not fill the owner home merely because a card slot exists. A quiet home is better than irrelevant advice.

## 3. Advice must be contextual, small and actionable

Palta should not lecture the owner or present itself as a superior business expert.

Preferred pattern:

```text
observation
-> why it may matter
-> one practical action
-> do it now / dismiss / remind later
```

Examples:

```text
"Tu horario no se confirma hace 5 meses. ¿Sigue igual?"
[Sí, sigue igual] [Cambiar]

"Muchas personas encuentran negocios como el tuyo buscando 'vulcanización', pero ese servicio no aparece en tu perfil."
[Agregar servicio] [No lo ofrecemos]

"Tus clientes vuelven por WhatsApp. Puedes poner un QR de tu página Palta en el empaque para que la próxima vez encuentren menú, horario y beneficios sin buscar de nuevo."
[Crear QR] [Después]
```

The owner should usually complete the action inside Palta rather than be sent to a long tutorial.

## 4. Free tools should raise the baseline capability of small businesses

Palta may provide useful low-cost or near-zero-cost tools on the free baseline when they materially improve the local ecosystem.

Examples include:
- QR/link assets from canonical Business data;
- simple printable sign / counter card / opening-hours card templates;
- basic post and coupon publishing for verified owners;
- profile completeness and freshness checks;
- basic advice about presenting services, photos, prices and hours more clearly;
- social/contact links;
- simple owner-confirmed corrections;
- basic customer follow/save relationship.

These are not charity features detached from the business model. They improve discoverability, data quality, customer trust and network value for Palta as well.

## 5. Paid value means Palta does more of the work

The free product should tell the owner what can help and let the owner do it simply.

Paid/advanced value may automate or consolidate meaningful work.

Examples:

```text
FREE
- publish one post in Palta
- create a basic coupon
- generate a QR
- confirm business hours
- connect Instagram/Facebook/Google/website links

ADVANCED / PAID WHEN POLICY ENABLES IT
- publish once and distribute to supported external channels
- schedule campaigns
- transform content for each channel
- segment regular customers
- automate repeat-visit / win-back flows
- coordinate booking/order/inventory/POS status
- consolidate channel metrics
- reduce repetitive admin/fiscal preparation
```

Do not intentionally make the free workflow painful to manufacture demand for the paid workflow.

## 6. Open-channel doctrine — integrate competitors instead of pretending they do not exist

Palta must not require an owner to abandon a channel that already brings customers.

The default posture is:

```text
if Uber Eats brings demand -> let the owner keep using it
if Instagram brings demand -> connect it
if WhatsApp is how customers talk -> preserve it
if Google brings discovery -> link and keep business truth consistent where possible
if an existing POS/payment terminal works -> do not require replacement merely to use Palta
```

Palta wins by reducing fragmentation and giving the business one coherent operating layer.

Strategic objective:

```text
many external channels
        ↓
Palta Business identity + operating truth + customer relationship
        ↓
owner can understand/manage more from one place
```

Channel integration must not create duplicate Business, Product, Customer or Order truth when a canonical record already exists. Use adapters/projections and preserve source/channel attribution.

## 7. Food and delivery — use external acquisition, improve direct economics

Food illustrates the doctrine clearly.

External delivery marketplaces may have large discovery traffic that Palta cannot initially match. The correct response is not to block them.

```text
external marketplace / Google / social / Palta discovery
        ↓
restaurant is discovered
        ↓
customer relationship can later continue through the restaurant's Palta page
        ↓
direct repeat order / pickup / merchant delivery / external fulfillment
```

Palta should help the owner understand channel economics in plain language, using current verified data where available.

The recommendation goal is not automatically "leave the marketplace". It is to show options such as:
- keep marketplace acquisition;
- use Palta for repeat customers/direct links;
- put a QR on packaging/receipt/counter;
- offer a customer benefit where direct economics permit it;
- preserve pickup or merchant delivery where suitable;
- later allow Palta POS/order operations to reconcile multiple channels so the owner does not manage disconnected systems.

Exact fees, commissions, transaction charges or savings must come from current provider terms and Palta `PricingPolicy`, never from remembered hard-coded percentages.

## 8. QR/direct-relationship loop

A low-cost physical-to-digital bridge is especially valuable for small businesses.

Possible locations:
- takeaway bag;
- food package;
- receipt;
- counter;
- table;
- storefront;
- business card;
- vehicle/service sticker where appropriate.

QR should normally resolve to the canonical public Business page or a specific business-owned Palta action, not a separately maintained microsite.

Possible loop:

```text
first discovery/purchase anywhere
-> QR / direct Palta link
-> current business page
-> save/follow/regular-customer opt-in
-> later direct discovery/contact/order
```

This must respect consent and notification controls. A QR scan does not grant marketing permission by itself.

## 9. Business-channel consolidation

A business may have:
- Palta page;
- Instagram personal/professional account;
- Facebook/Page;
- Google Business Profile;
- WhatsApp;
- marketplace/delivery account;
- existing website;
- POS/payment provider.

Palta should model each as a `BusinessChannelConnection`-style relationship or equivalent canonical adapter contract, not duplicate business identity.

Capability levels should distinguish:

```text
LINK_ONLY
- public link/contact; works even if no API automation is possible

ASSISTED_SHARE
- Palta prepares content/assets, owner completes posting in the external app

CONNECTED_READ
- Palta can read permitted state/metrics

CONNECTED_PUBLISH
- Palta can publish/update through the provider API with explicit authorization

CONNECTED_OPERATE
- deeper operational integration such as orders, fulfillment or POS reconciliation
```

Never assume every small merchant uses a professional/business social account. Link-only and assisted-share flows must remain first-class.

## 10. Fiscal/admin help — partner, not unauthorized professional substitute

Small owners may find Chilean tax, DTE, municipal and administrative obligations expensive or difficult to understand.

Palta can create major value by reducing repetitive administrative work, but must distinguish:

```text
trusted public information / deadlines
-> personalized checklist
-> document/data preparation
-> reminders and status
-> integration/automation where legally valid
-> professional accountant/legal escalation when judgment or representation is required
```

Palta should not claim that generic AI output is tax/legal certification.

Where possible, the owner should see plain-language status such as:

```text
"Este mes tienes 2 tareas tributarias pendientes."
"Ya tenemos la información de ventas necesaria para preparar el resumen."
"Este punto necesita revisión de tu contador."
```

The long-term value is reducing the amount of expensive professional time spent on clerical/repetitive work while preserving professional judgment where needed.

## 11. Personalization inputs and privacy boundary

Owner personalization may use information legitimately related to the owner-managed Business and Palta usage, for example:
- industry/service taxonomy;
- business location/service area;
- claimed role and permissions;
- business lifecycle/operating state;
- seasonality and schedule;
- enabled capabilities;
- public profile completeness/freshness;
- aggregate discovery/search/contact signals;
- owner-authorized channel connections;
- business-side order/booking/quote/POS state;
- opt-in customer relationship signals in aggregate or authorized operational context;
- current regulatory/admin deadlines from trusted sources.

Do not expose unrelated private customer data to the owner. Do not use personal consumer data as a hidden sales tool. Use least privilege and purpose-specific access.

## 12. Recommendation priority order

When deciding what to show the owner next, prefer:

```text
1. urgent operational / compliance / customer issue
2. inaccurate or stale public truth
3. missed customer action caused by missing basic information
4. free/simple improvement with clear practical value
5. workflow friction Palta can reduce
6. advanced/paid capability when evidence shows actual need
7. generic educational content
```

A paid feature must never outrank a more important free correction merely because Palta could earn money from the paid feature.

## 13. Success criteria

Local Business succeeds when:
- consumers trust Palta to find businesses that actually exist and are usable;
- free Business pages are valuable enough that owners want to claim and maintain them;
- owners feel Palta reduces work rather than creates another channel to manage;
- repeat customer relationships accumulate voluntarily inside Palta;
- external channels become easier to manage through Palta rather than being forcibly replaced;
- paid features are purchased because they save time, reduce cost, improve operations or create measurable value;
- owner advice feels like a useful partner, not an upsell funnel;
- the same foundation can later support POS, order, delivery, customer management, fiscal preparation and other modules without recreating Business identity.

Canonical product sentence:

> **Palta should help the owner run a better business first; Palta earns money by making that help deeper, easier and more automated.**
