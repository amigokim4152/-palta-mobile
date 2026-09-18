# Somos Palta Food Data Catalog

## Purpose

Build a Chile food taxonomy and a reliable Palta restaurant catalog without treating any delivery platform as Palta's production database.

Uber Eats can be used as a high-density **market-research reference** for understanding what is actually sold in Chile and how menus are structured. It is not the canonical source for Palta production records, and platform categories are never copied directly into Palta navigation.

## Three data layers

Food data is separated into three explicit layers:

1. `research_observation`
   - limited market-research observations from delivery platforms such as Uber Eats;
   - useful for discovering restaurants, menu concepts, category noise and Chile-specific dish vocabulary;
   - never sufficient by itself to publish a Palta canonical business, public contact, menu or current price.

2. `independent_corroboration`
   - independently checked public evidence such as an official restaurant website, official social account, merchant registration, public registry or other suitable public source;
   - used to confirm business/outlet identity, address, public business contact, menu facts and prices;
   - retains source URL and observation date.

3. `canonical_production`
   - facts eligible for Palta's live business/menu experience after identity and fact-level source requirements are satisfied;
   - remains traceable back to its evidence;
   - owner/merchant-provided data is preferred when available.

The core rule is:

`delivery-platform discovery/reference -> independent verification -> Palta canonical production`

## Source policy

### Delivery platforms

A delivery-platform observation may help answer:

- which restaurants or brands exist as discovery candidates;
- which foods appear to be sold in Chile;
- how merchant menu sections and commercial formats are commonly structured;
- which cuisine/dish terms require taxonomy support.

A delivery-platform observation alone must **not**:

- create a production Canonical Business/Outlet automatically;
- publish a phone/WhatsApp number as verified;
- publish a menu item or current price as a Palta canonical fact;
- supply copied platform photos, reviews, ratings or long creative descriptions.

### Independent production sources

Eligible corroborating sources include, subject to normal quality checks:

- official merchant website;
- official merchant social account;
- merchant/owner registration in Palta;
- public registry or public institutional source;
- independently maintained public business directory/location source where appropriate;
- another public source with materially independent provenance.

Only public business contact information belongs in the catalog. Do not infer or expose private personal contact information.

## Collection unit

When researching a candidate, collect the restaurant context and menu context together when available:

1. Brand / business name.
2. Outlet / branch name.
3. Public street address, comuna, region and postal code.
4. Public business phone / WhatsApp / website from an independent source when available.
5. Research listing ID/URL when the record originated from a market-research reference.
6. Research platform categories and availability observations as non-canonical evidence.
7. Merchant-authored menu section names.
8. Menu item names and observed CLP prices only as dated observations until independently confirmed.
9. Delivery / pickup / scheduled-order observations.
10. Observation timestamp and evidence URLs.

### Collect first, contact second

The operational sequence is deliberately:

`collect factual candidate data -> organize/normalize -> find public business contact -> queue merchant outreach -> request authorization -> promote approved facts`

During the initial collection phase:

- **do not collect or copy photos**;
- do not copy reviews, ratings or long creative descriptions;
- prioritize factual business/menu fields only;
- keep public phone/WhatsApp/website when independently available so the merchant can be contacted later;
- do not send outreach automatically from the food catalog pipeline.

`scripts/build-food-merchant-outreach-queue.mjs` produces the contact queue. Actual WhatsApp sending belongs to the shared Messaging Core.

The default merchant authorization request covers business identity, outlet address, public contact, opening hours, menu item names, menu prices and pickup/delivery facts. Images are intentionally excluded and would require a separate future asset permission flow.

## Identity model

Do not assume `one delivery-platform listing = one canonical Palta Business`.

The model is:

`Canonical Business / Brand -> Outlet -> Platform Presence -> Listing history -> Menu Snapshot -> Section -> Item`

Known identity risks include:

- several separately named delivery listings sharing one public address;
- a listing name implying one comuna while its exposed address points to another;
- one verified physical outlet having an old closed platform listing ID and a different active listing ID later;
- virtual brands or ghost kitchens sharing a physical kitchen.

Therefore platform listing ID, brand name and street address cannot independently define a Palta Business or Outlet.

### Identity statuses

- `verified`: an official/merchant source confirms the outlet materially.
- `corroborated`: suitable independent public evidence agrees materially.
- `platform_only`: currently only a market-research platform observation exists.
- `needs_review`: material conflicts remain.
- `possible_virtual_brand`: shared-address / brand evidence suggests a virtual or kitchen-only listing.

Only `verified` and `corroborated` identities are candidates for canonical production, and fact-level evidence requirements still apply separately. A verified outlet does not automatically make an Uber-only menu or price canonical.

## Raw evidence vs Palta normalization

Always preserve source facts separately from Palta normalization:

- source restaurant/listing name;
- source category labels;
- source address text when relevant;
- source menu section name;
- source menu item name;
- observed price;
- observed availability / closed state;
- source and observation date.

Normalization is a second layer. A menu item can then receive independent dimensions such as:

- `dishFamily`: completo/hotdog, sandwich, burger, pizza, sushi roll, chicken, rice dish, noodle dish, soup/stew, seafood, empanada/pastry, salad/bowl, bakery, dessert, ice cream, coffee/tea, beverage, other;
- `cuisineTags`: Chilean, Peruvian, Japanese, Korean, Chinese, American, Italian, Mexican, Venezuelan, Middle Eastern, Indian, Latin American, other;
- `servingFormat`: single, combo, share, family, promotion, meal deal, by weight, unknown;
- later: meal occasion, dietary facts, ingredients, preparation style, portion size and modifier groups when evidence exists.

Do not force a single category when the product naturally belongs to several dimensions.

### Never classify from the brand name alone

A restaurant brand can be misleading about what is actually sold. Classification must be driven by independently usable menu evidence, not the merchant name.

## Why delivery-platform categories cannot become Palta categories

Real listings demonstrate category overloading. A restaurant may receive many platform tags that are useful for platform search/recommendation but are too noisy for a clean Palta information architecture.

Palta consumer categories should be designed from aggregated research signals and independently supported menu concepts, not copied platform category labels.

## Category design process

1. Use bounded research samples to discover menu vocabulary, dish patterns and category problems.
2. Preserve research observations in the research layer only.
3. Build provisional dish/taxonomy signals without changing source names.
4. Count item frequency, section frequency and tag/dish co-occurrence from the research corpus.
5. Track unmatched menu items instead of forcing them into a catch-all category.
6. Identify Chile-specific stable concepts such as completo, churrasco, chorrillana, pollo asado, empanada, ceviche and hand roll.
7. Separate dish intent, cuisine intent and commerce format.
8. Independently verify production businesses, outlets, contacts and menus before publishing them in Palta.
9. Re-run research periodically without converting the delivery platform into a Palta bulk-ingestion source.

The research scripts intentionally call their classification outputs `signals`; they are provisional analytical labels, not the final product taxonomy.

## Research sufficiency gate

`data/food/chile/rm/corpus-coverage.json` defines a research sufficiency gate for taxonomy design. It is not a target for bulk copying any external service. The navigation can be prototyped earlier, but taxonomy v1 should not be treated as stable until coverage is sufficiently diverse across geography, dish types and identity-risk examples.

## Freshness

Menu price, availability and opening data are observations, not permanent truth. Every snapshot must carry an observation date/time. Current Palta UI must not present stale or research-only prices as verified current facts.

A platform-closed listing does not prove the physical business permanently closed. Likewise, a replacement listing ID can appear for a still-active outlet. Platform availability and physical business lifecycle remain separate facts.

## Copyright and source handling

Palta production data focuses on factual fields needed for discovery and commerce: business/outlet identity, public business contact information, address, menu item names, prices, option facts and availability facts supported by appropriate independent evidence.

Do not copy delivery-platform imagery, reviews, ratings or long creative menu descriptions into Palta without an appropriate right or merchant-provided asset. Research observations remain provenance-bearing research records and are not automatically surfaced to users.
