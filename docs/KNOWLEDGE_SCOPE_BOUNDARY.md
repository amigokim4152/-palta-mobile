# Palta Knowledge Scope Boundary

## Purpose

Palta must be able to collect and evolve data before every final product/service boundary is known.

The stable classification is therefore based on **two independent axes**:

1. **Domain** — what the datum is about.
2. **Content class** — how the datum behaves over time.

A storage/service route may be provisional. Re-routing must not require changing canonical identity, provenance, geographic scope or validity metadata.

## Content classes

| Content class | Current route | Status | Canonical Knowledge? | Examples |
| --- | --- | --- | --- | --- |
| durable_knowledge | canonical_git | fixed | yes | food selection/storage guide, health explanation, pet lifecycle guide, cultural background, curriculum concept |
| dynamic_observation | dynamic_read_model | provisional | no | current produce price, supply level, current seasonal market observation |
| public_benefit | shared_data_unresolved | provisional | no | municipal subsidy, application window, local benefit |
| public_event | shared_data_unresolved | provisional | no | concert, exhibition, municipal cultural schedule, festival date |
| institution_state | shared_data_unresolved | provisional | no | opening hours, temporary closure, appointment availability |
| news | news_system | fixed | no | article, breaking report, local news item |
| private_context | private_store | fixed | no | user health state, child progress, private pet record, read/snooze history |

`provisional` means Palta may later move that class to another DB/service/core without changing what the datum is.

## Domain x content-class examples

### Food

- `How to choose and store avocados` -> `food + durable_knowledge`.
- `Avocado price in Santiago today` -> `food + dynamic_observation`.
- `Avocado harvest beginning in a region` may be an observation/event depending on source semantics; it does not need to be forced into Knowledge Core.

### Culture

- `History and meaning of Fiesta de La Tirana` -> `culture + durable_knowledge`.
- `Fiesta de La Tirana event this weekend` -> `culture + public_event`.

### Health

- `General explanation of hypertension` -> `health + durable_knowledge`.
- `Clinic hours today` -> `health + institution_state`.
- `Vaccination campaign next week` -> `health + public_event` or a future program class if the shared data model later adds one.

## Projection is separate

Classification does not decide where a datum is shown.

The same structured datum may later project to:

- Palta Home;
- Search;
- Community;
- Local/Neighborhood;
- a specialist site such as Food, Health or Pets;
- News/editorial as a referenced source;
- future surfaces not yet designed.

Projection should reference the source/canonical ID instead of copying ownership.

## Fixed boundaries

The following are currently treated as architectural decisions:

- durable public knowledge is versioned/reviewed as Canonical Knowledge;
- News is a separate Palta system;
- private personal/relationship context remains isolated from public data.

## Intentionally unresolved boundaries

Do not prematurely hard-code final ownership for:

- public benefits and deadlines;
- cultural/public event schedules;
- institution operational state;
- current prices, supply, availability and similar observations.

Their route is provisional until the surrounding Palta Public Data/Event/Observation architecture is settled.

## Required migration metadata

When legacy/Base44 material is extracted, preserve enough metadata to reroute later:

```text
domain
content_class
legacy_source
legacy_entity
legacy_record_id
source_ref
canonical_ref (when known)
country / region / locality
valid_from / valid_until / observed_at
verification state
projection hints (optional)
```

This allows Palta to reorganize infrastructure later without losing source lineage or rebuilding data identity.
