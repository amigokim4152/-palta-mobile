# Autos Chile Data Ingestion V1

Status: executable contract companion for `integration/autos-v1`.

## Goal

Keep Autos easy for the user without making the mobile app a scraper, a legal-record database, or a large public-dataset processor.

The runtime should consume small normalized Palta projections. Collection, normalization and source verification happen outside the mobile bundle.

## SII vehicle valuation

Official source:

- landing: `https://www.sii.cl/servicios_online/1049-2612.html`
- 2026 light-vehicle download: `https://www.sii.cl/servicios_online/tasacion_fiscal_vehiculos/liv2026.xlsx`
- SII announced 81,611 light-vehicle valuations for 2026.
- the source can be corrected during the year; the 2026 normative page includes later correction/complement resolutions.

Pipeline:

`SII XLSX -> collector -> source checksum -> parser/normalizer -> validation -> immutable snapshot -> lookup index/API -> Autos`

The XLSX is never bundled into the mobile application and is never fetched by a phone during the selling flow.

Each promoted snapshot must retain:

- dataset/snapshot ID
- official source URL
- effective year
- collection and source-observed times
- source checksum
- row count
- freshness/status
- normalized records

Matching policy:

1. SII code + manufacture year is preferred.
2. Exact make + model + version + manufacture year may be used when unique.
3. Make + model + year without a unique version must remain unresolved.
4. Palta never invents a fiscal valuation to complete the UI.
5. If no official match is available, the user sees a minimum/partial estimate and the missing fact is requested only when it materially changes the transaction.

## CAVEM / public dealer directory

The public CAVEM Central Zone directory is a discovery seed, not a dealer authorization list.

Pipeline:

`public directory -> source snapshot -> normalize website/name/comuna -> dedupe -> canonical Business reconciliation -> review/claim -> Palta verification -> Autos acquisition capability`

Rules:

- Never create a second Autos-specific Business identity.
- Website host is a strong reconciliation signal.
- Name/comuna alone is treated conservatively.
- Ambiguous rows remain candidates for review.
- Public membership never grants `verified` state.
- Public membership never grants `vehicle_private_buy_bid` capability.
- Finance, rental, warranty, marketplace and adjacent automotive businesses can appear in the source snapshot but do not enter the acquisition pool unless their canonical Business is explicitly verified and enabled for that capability.

## Privacy boundary

Public sources may seed non-personal business facts and fiscal vehicle taxonomy. They must not be used to build a bulk plate-to-owner, RUT, address or legal-record database.

Personal vehicle/legal information remains user-initiated, purpose-limited and private. Exact location/contact data is not shared with bidders before the user chooses to coordinate.

## Runtime projection

The mobile Autos flow consumes only:

- resolved vehicle facts with provenance
- fiscal value when uniquely resolved
- canonical Business IDs
- verified acquisition capability and routing constraints
- user-owned private facts required for the active sale

This preserves the low-cost initial implementation while allowing future partner APIs, device OCR and paid recognition adapters without rewriting the UX or canonical identities.
