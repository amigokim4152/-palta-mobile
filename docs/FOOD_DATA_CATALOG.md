# Somos Palta Food Data Catalog

## Purpose

Build a Chile food corpus from public evidence before freezing consumer-facing categories.

Uber Eats is treated as a high-density observation source for what is actually being sold in Chile, not as the Palta taxonomy. Platform category labels are intentionally preserved as source facts but are never copied directly into Palta navigation.

## Collection unit

One collection pass should capture the restaurant context and menu context together:

1. Brand / business name.
2. Outlet / branch name.
3. Public street address, comuna, region and postal code when exposed.
4. Public business phone / WhatsApp / website when exposed by an official or corroborating public source.
5. Platform listing ID and URL.
6. Platform categories and availability flags.
7. Merchant-authored menu section names.
8. Menu item names and observed CLP prices.
9. Delivery / pickup / scheduled-order observations.
10. Observation timestamp and evidence URLs.

Do not infer private contact information. Only public business contact data belongs here.

## Identity model

Do not assume `one Uber Eats listing = one canonical Palta Business`.

The model is:

`Canonical Business / Brand -> Outlet -> Platform Listing -> Menu Snapshot -> Section -> Item`

A shared address can represent a normal multi-brand venue, a ghost kitchen, a virtual brand or bad source data. Same-address listings therefore remain distinct until identity evidence is sufficient.

### Identity statuses

- `verified`: official source confirms the outlet identity/contact/address.
- `corroborated`: at least two independent public sources agree materially.
- `platform_only`: currently observed only on the delivery platform.
- `needs_review`: material conflicts remain.
- `possible_virtual_brand`: shared-address / brand evidence suggests a virtual or kitchen-only listing.

Only `verified` and `corroborated` outlet identities should automatically attach to a canonical Palta Business. Other records remain discoverable research evidence until reviewed.

## Raw data vs Palta normalization

Always preserve the original merchant/platform facts:

- source restaurant/listing name
- source category labels
- source menu section name
- source menu item name
- observed price

Normalization is a second layer. A menu item can then receive independent dimensions such as:

- `dishFamily`: completo/hotdog, sandwich, burger, pizza, sushi roll, chicken, rice dish, seafood, empanada/pastry, fries/side, bakery, dessert, beverage, other.
- `cuisineTags`: Chilean, Peruvian, Japanese, Korean, Chinese, American, Italian, Latin American, other.
- `servingFormat`: single, combo, share, family, promotion, meal deal, unknown.
- later: meal occasion, dietary facts, ingredients, preparation style, portion size and modifier groups when evidence exists.

Do not force a single category when the product naturally belongs to several dimensions.

## Why Uber Eats categories cannot become Palta categories

Real listings demonstrate platform-category overloading. A sushi outlet can simultaneously be tagged Japanese, Asian, Sushi, Korean, Burgers, Chicken, Seafood, budget and family-meal. A chicken shop can sell completos, sandwiches, sushi promotions and chorrillanas. These labels are useful retrieval signals but are too noisy for a clean Palta IA.

Palta consumer categories should be designed only after corpus analysis of actual menu-item frequencies and co-occurrence.

## Category design process

1. Collect raw listings and menu snapshots at scale.
2. Normalize obvious dish families without changing source names.
3. Count item frequency, section frequency and cuisine/dish co-occurrence.
4. Identify Chile-specific stable concepts (for example completo, churrasco, chorrillana, pollo asado, empanada, ceviche, hand roll).
5. Separate high-frequency dish intent from cuisine intent.
6. Build a small consumer-facing category set from observed demand/supply, while keeping a deeper searchable taxonomy underneath.
7. Re-run the analysis periodically because menus and platform supply change.

## Freshness

Menu price, availability and opening data are observations, not permanent truth. Every snapshot must carry `observedAt`. Historical snapshots may be retained for change detection, but current UI must not present stale prices or availability as current facts.

## Copyright / source handling

Store factual fields needed for discovery and commerce: business/outlet identity, public contact information, address, source section names, item names, prices, option facts and availability observations. Do not copy long creative menu descriptions or platform imagery into Palta without an appropriate right or merchant-provided asset.
