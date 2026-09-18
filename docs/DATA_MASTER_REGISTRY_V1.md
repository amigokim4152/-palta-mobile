# Palta Data Master Registry v1

## Purpose

Palta needs one cross-domain inventory before more datasets are created. This registry records what already exists, where its Source of Truth lives, how it is refreshed, who consumes it, whether it is public/private, and whether the existing asset should be kept, connected, upgraded, rebuilt, archived, or audited.

This is broader than Knowledge. Education, Health, Pets, Food and Music are only some data domains inside the overall Palta data system.

## Data classes

1. `source_raw_research`
   - Original source material, research notes, imported legacy data, raw snapshots and source registries.
2. `canonical_public`
   - Normalized public entities shared across Palta: geography, municipality/public services, GTFS static data, places/facilities, canonical businesses and similar data.
3. `knowledge_content`
   - Durable explanatory knowledge: principles, mechanisms, concepts, guides, evidence and domain knowledge.
4. `news_editorial`
   - News-source registry, reviewed/approved editorial material and deep reporting.
5. `runtime_event`
   - Live or rapidly changing state: bus ETA, live weather, earthquake/disaster and operational events.
6. `product_transaction`
   - User/business actions and state: Care, reservations, queue, Community, Messaging, Commerce/POS/Payment and related flows.
7. `private_person`
   - Profile, relationships, health records, learner progress, pet records, private location context and personalization state.
8. `static_asset`
   - PMTiles, images, media, brand assets, snapshots and release packages.

## Required fields

Every registered asset must eventually have:

- `assetId`
- `name`
- `scope`
- `assetClass`
- `domain`
- `sourceOfTruth`
- `currentLocation`
- `sourceOrigin`
- `visibility`
- `dataClass`
- `updateMode`
- `updateFrequency`
- `versionStrategy`
- `countryScope`
- `regionScope`
- `consumers`
- `pipelineOwner`
- `runtimeOwner`
- `migrationDecision`
- `verificationStatus`
- `lastCheckedAt`
- `notes`

## Migration decisions

- `KEEP`: existing asset remains authoritative as-is.
- `CONNECT`: asset is valid and should be connected to current Palta architecture.
- `UPGRADE`: asset is valid but schema/runtime/versioning needs improvement.
- `REBUILD`: source/value is retained but implementation needs rebuilding.
- `ARCHIVE`: no longer active; preserve only for history, rollback or evidence.
- `AUDIT_REQUIRED`: identity, freshness, quality, ownership or duplication is not yet verified.

## Source-of-Truth rule

A new Palta surface must not automatically create a new dataset. One real-world concept should keep one canonical identity. Home, Community, specialist sites, Search and other surfaces may project the same canonical object.

Example:

`canonical school -> Community school context / Education curriculum context / Search / Home relevance`

The canonical school is not copied into four independent databases.

## Public/private hard boundary

Public canonical data and public Knowledge must not contain private person/family/health/learner/exact-location state. Private projections may reference public canonical IDs, but private state remains in private storage and must never be promoted automatically into public Knowledge.

## Processing lanes

### Data Factory

Use for repeatable source-driven static or periodically refreshed external datasets:

- Map/Geo
- Government/public data
- Municipality/Local
- GTFS/static mobility
- Places/facilities
- Local Business discovery
- Public events/culture
- other repeatable external datasets

Pipeline:

`source -> change detection -> collect -> preserve RAW -> normalize -> dedupe/link -> validate -> diff -> canonical build -> release -> R2/read model -> exception report`

### Runtime/Event Core

Use for live or fast-changing state:

- bus ETA
- live weather
- earthquake/disaster
- operational status
- event notifications

### Knowledge Ops

Use for durable explanatory knowledge and specialist/Bodega domains. AI/humans propose revisions against an explicit base version; validated review/publish changes production knowledge.

### Product cores

Use for transaction and interaction state:

- Care/Event
- Community
- Messaging
- Commerce/POS/Payment
- reservation/queue/order/delivery flows

### Private store

Use for private user state, including profile, relationships, health/pet/learner records and personalized Home state.

## Initial inventory decisions — 2026-09-18

| Asset / area | Asset class | Current SOT / location | Decision | Initial finding |
|---|---|---|---|---|
| Palta Foundation master documents | source_raw_research | Google Drive `00_Foundation` | KEEP | Product/Experience/Infrastructure authority remains in Drive. |
| Palta Data Factory plan | source_raw_research | Google Drive `00_Foundation` | KEEP | Already defines common collection/release pipeline. |
| `/Users/user/palta-data` | mixed | Local Mac | AUDIT_REQUIRED | Preserve first; inspect engine/work/r2-backup/PMTiles/GTFS/local-place before migration. |
| Santiago PMTiles | static_asset + canonical_public | Local/R2 state to verify | CONNECT | Existing generated asset exists; current R2 byte-range/release still requires explicit audit. |
| GTFS/static mobility | canonical_public | Local Data Factory assets | CONNECT | Static data belongs to Data Factory; realtime ETA belongs to Runtime/Event Core. |
| Government/public policy/service data | canonical_public | Data Factory/source registry | UPGRADE | Needs normalized source, status, version and national/local coverage. |
| Municipality/local data | canonical_public | Data Factory | UPGRADE | 346-comuna coverage and verification states remain the target. |
| Places/facilities | canonical_public | Data Factory | CONNECT | Schools, hospitals, pharmacies, public/cultural/sports facilities. |
| Local Business discovery | canonical_public | Data Factory + Local Business Core | CONNECT | Discovery/normalization in Data Factory; owner-managed state remains Business Core. |
| News Editorial Bridge | news_editorial | Drive `00 Infrastructure & Operations/01_News_Editorial_Bridge` | KEEP | Existing lifecycle: INBOX -> REVIEWED -> APPROVED -> ARCHIVE. |
| Pets | knowledge_content | Drive `Pets` folder found | AUDIT_REQUIRED | Existing dedicated folder must be inspected before canonical migration. |
| Health | knowledge_content | master specs + legacy research | AUDIT_REQUIRED | Public general knowledge must be separated from private health records. |
| Food | knowledge_content | no dedicated Drive asset found in first pass | AUDIT_REQUIRED | Search legacy Base44/Chile-K/NAREVU material before creating new silo. |
| Education | knowledge_content | Knowledge platform curriculum seed | CONNECT | One Knowledge domain; do not let curriculum work drive the whole data architecture. |
| Music | knowledge_content | no Palta-dedicated Drive asset found in first pass | AUDIT_REQUIRED | Keep as Bodega/seed until enough canonical content exists. |
| Community | product_transaction + canonical refs | Community integration work | CONNECT | User-generated state is not canonical Knowledge; Community may reference canonical IDs. |
| Commerce/POS/Payment | product_transaction | commercial-core integration work | CONNECT | Transaction state remains outside public canonical/Knowledge stores. |
| Message Core | product_transaction | message-core integration work | CONNECT | Message state remains separate from public data. |
| Private profile/personalization | private_person | private storage architecture | CONNECT | Never copied into public canonical/Knowledge data. |
| App Prep ZIP versions | static_asset | Drive `02_Build_Releases/App_Prep` | ARCHIVE | Preserve release history; active code Source of Truth is GitHub, not the ZIP chain. |

## Scope guard

Drive-wide search results are not automatically Palta assets. Personal records, SL FILMS, Sharon, church files, unrelated shared documents and other non-Palta materials must be excluded from the primary registry or explicitly registered under a different scope.

The main registry uses `scope = palta_product`.

## Next audit sequence

1. Audit the real `/Users/user/palta-data` filesystem when available and register every concrete asset.
2. Inspect the existing Drive `Pets` folder and classify its contents.
3. Recover Base44 / Chile-K / NAREVU legacy data and map each source into this registry without duplication.
4. Enumerate active GitHub integration branches and map each branch to data producers/consumers.
5. Register News Editorial Bridge contents and news-source registries.
6. Register Health, Food, Education, Music and other Knowledge/Bodega assets after legacy-source audit.
7. Expand the machine-readable `data/registry/assets.v1.json` only after identity collisions are resolved.

## Non-goals

- No production database migration is applied by this registry.
- No existing local dataset is deleted during inventory.
- No legacy asset is overwritten before its identity and value are determined.
- No private-person data is copied into public canonical or public Knowledge storage.
