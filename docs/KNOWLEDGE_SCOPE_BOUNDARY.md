# Palta Knowledge Scope Boundary

## Purpose

Palta Knowledge Core stores durable, reviewable knowledge. It must not become a catch-all warehouse for every collected record.

The classification decision is based on **content behavior**, not only the subject/domain name.

## Storage lanes

| Content class | Storage lane | Canonical Knowledge? | Examples |
| --- | --- | --- | --- |
| durable_knowledge | canonical_git | yes | food selection/storage guide, disease prevention explanation, pet lifecycle guide, cultural background, curriculum concept |
| dynamic_observation | dynamic_read_model | no | current produce price, current seasonal market observation, current availability signal |
| public_benefit | public_data_event_core | no | municipal subsidy, application window, local benefit |
| public_event | public_data_event_core | no | concert, exhibition, municipal cultural schedule, festival date |
| institution_state | public_data_event_core | no | opening hours, temporary closure, appointment availability |
| news | news_system | no | article, breaking report, local news item |
| private_context | private_store | no | user health state, child progress, private pet record, read/snooze history |

## Important examples

### Culture

- `History and meaning of Fiesta de La Tirana` -> durable knowledge -> Knowledge Core.
- `Fiesta de La Tirana events this weekend` -> public event -> Public Data/Event Core.

### Food

- `How to choose and store avocados` -> durable knowledge -> Knowledge Core.
- `Avocado price in Santiago today` -> dynamic observation -> Dynamic Read Model.
- A current observation may reference the canonical avocado Knowledge ID without being copied into the canonical source.

### Public benefits

Municipal benefits, application deadlines and eligibility windows remain in Public Data/Event Core even if they contain educational or cultural wording. A durable explanation such as `how Chilean municipal benefits are commonly structured` may exist separately as Knowledge Core content.

### News

News is maintained as a separate Palta system. News content must not be ingested into Knowledge Core simply because it contains useful factual material. Durable knowledge derived later from verified sources requires its own evidence-backed Knowledge revision.

## Canonical folder intent

```text
knowledge/
  registry/
  food/
  health/
  pets/
  education/
  culture/
  music/
  art/
  finance/
  clothing/
  hobby/
```

Each canonical entity should eventually have a stable ID, versioned sections, evidence references, locale state, country/local overlays and review state.

## Integration rule

External lanes may **link to** canonical Knowledge IDs. They must not be copied into canonical knowledge merely to make integration easier.

This keeps:

- Knowledge Core durable and reviewable.
- Public/Event data current and replaceable.
- News operationally independent.
- Private context isolated from public content.
