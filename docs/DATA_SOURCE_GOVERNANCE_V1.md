# Palta Data Source Governance v1

Status: mandatory cross-domain implementation contract.

This contract applies to every Palta collector, research workflow, import job, Local Business ingestion flow, public-data pipeline, market/catalog ingestion flow, and future country-layer data source.

## Core rule

**Discovery is not canonical evidence.**

A source may help Palta discover that a business, place, menu item, service, event, or category exists without being an allowed source for direct bulk ingestion into Palta's canonical database.

The required flow is:

`discover -> evidence queue -> independent verification -> normalize -> dedupe -> provenance/rights gate -> canonical record -> publish`

A discovered record must not become a public canonical record only because it was visible on a third-party platform.

## What Palta may structure as factual data

When independently verified from a permitted source, Palta may normalize factual fields such as:

- business/place name;
- street address and geographic position;
- official business telephone or WhatsApp contact;
- category and service type;
- opening hours;
- menu/product/service item name;
- current listed price;
- official website or official action/contact endpoint;
- other objective operational facts supported by evidence.

These facts must be stored in Palta's own canonical schema rather than as a copy of another platform's page or database presentation.

## Content that is not copied into the canonical dataset

Unless Palta has an explicit license, permission, or owner-supplied asset, collectors must not copy into the canonical dataset:

- third-party photos or videos;
- user reviews or review text;
- platform-written descriptions;
- long promotional/editorial descriptions;
- third-party rankings or scores as Palta's own data;
- copyrighted menu artwork, screenshots, PDFs, or page layouts;
- third-party posts or comments;
- personal contact information whose business/public purpose is unclear.

Palta may store a source URL, source identifier, digest, timestamp, and internal evidence metadata needed for verification without republishing the source content.

## Discovery sources versus canonical evidence sources

### Discovery / research sources

Third-party marketplaces, delivery platforms, map/search products, aggregators, social networks, and similar services may be used as discovery or research signals when permitted for that use.

They can help identify:

- that a business may exist;
- category vocabulary used in Chile;
- likely menu/service concepts;
- candidates that require verification;
- potential changes that should trigger re-checking.

They must not automatically become the canonical source merely because they are comprehensive.

### Preferred canonical evidence

Prefer, in this order where practical:

1. business/venue/institution owner claim or direct submission;
2. official business or institution website and official published menu/catalog/contact page;
3. government/municipal/open-data source or official API whose reuse terms allow the intended use;
4. licensed/open geographic or registry data such as OSM, subject to its license obligations;
5. official business social account or other first-party public source, with review when terms or ownership are unclear;
6. independent secondary source only when reuse is permitted and provenance is retained.

For important fields, multiple independent sources may be retained as corroborating evidence.

## Source states

Every source registry entry must have an operational rights state:

- `GREEN` — approved for the specified Palta ingestion/reuse purpose;
- `REVIEW` — usable only after terms/license/personal-data review;
- `RESTRICTED` — discovery/research or limited-field use only; not a canonical bulk-ingestion source;
- `BLOCKED` — do not ingest from this source for the intended purpose.

The state applies to a **specific use and field set**, not to the entire internet domain forever. A provider may expose one licensed API while prohibiting scraping of another surface.

## Required provenance metadata

Collectors and import jobs should preserve, at minimum, the following metadata whenever applicable:

```text
source_id
discovery_source
evidence_sources[]
source_url
source_type
collection_method
terms_status
license
rights_state
permitted_fields[]
collected_at
last_verified_at
personal_data
copyright_asset
commercial_reuse
confidence
```

Canonical records must be traceable back to their supporting evidence without exposing internal review material to normal users.

## Business contact data

Treat an official store/business telephone or business WhatsApp differently from a person's private number.

- Prefer numbers explicitly presented for business contact.
- Mark uncertain person-level contact as personal-data review material rather than automatically publishing it.
- Owner claim/correction overrides stale secondary contact data after verification.
- Support correction, removal, and re-verification workflows.

## Menus and prices

Menu item names and listed prices may be normalized as factual data when independently verified from a permitted source.

Do not copy menu photography, artwork, page design, reviews, or promotional prose merely to obtain those facts.

A third-party delivery platform may be used to discover that an item or restaurant likely exists, but the preferred publication path is to verify the item/price from a first-party or otherwise permitted source before canonical publication.

## Technical collection boundary

Collectors must not bypass access controls or technical restrictions.

Do not implement:

- authentication or paywall bypass;
- CAPTCHA bypass;
- rate-limit evasion;
- credential/token extraction;
- access-control circumvention;
- private API access obtained without authorization.

A source being technically reachable does not make it approved for ingestion.

## Existing research data

Existing research/discovery datasets do not need to be discarded solely because their discovery source is restricted.

They may remain in a non-public research/evidence layer and be used to create verification candidates. They must pass the provenance/rights/publication gate before being promoted to canonical/public serving data.

## Collector implementation requirement

A new collector is incomplete unless it answers all of the following:

1. What is the discovery source?
2. What source legally/contractually supports canonical storage and reuse of each field?
3. Which fields are permitted?
4. Is any field personal data or copyrighted content?
5. What is the source rights state?
6. When was the field last verified?
7. What happens when sources conflict or disappear?

If those answers are unavailable, store the result as research/evidence requiring verification, not as an approved public canonical record.

## Relationship to Localization

Localization does not change provenance. The Spanish original or canonical factual value remains attached to the same entity; optional translations are additive presentation data. A translated value must not be used to disguise a restricted source or create a second canonical entity.
