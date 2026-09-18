# Palta Canonical Knowledge

This directory is the reviewable source layer for **durable public knowledge** used across Palta.

It is not a warehouse for every collected record.

## Canonical domains

```text
knowledge/
  registry/      # domain and source registries
  food/          # food, species, varieties, selection, storage, preparation, nutrition, safety
  health/        # public health knowledge; personal health data never lives here
  pets/          # public species/breed/lifecycle/care knowledge; private pet records never live here
  education/     # durable learning/curriculum knowledge and concepts
  culture/       # durable cultural knowledge, history, practices; not current event schedules
  music/         # durable music knowledge and guides
  art/           # durable art knowledge and guides
  finance/       # durable financial concepts/guides; not live prices/quotes
  clothing/      # durable apparel/material/care knowledge
  hobby/         # durable hobby knowledge and guides
```

Directories are materialized when the first canonical entity is added. The registry defines valid domains before every directory necessarily contains content.

## What does not belong here

- News -> separate News system.
- Municipal/public benefits and deadlines -> Public Data/Event Core.
- Cultural event schedules -> Public Data/Event Core.
- Current institution hours/availability -> Public Data/Event Core.
- Frequently changing prices/market availability -> Dynamic Read Model.
- User/family/health/pet private context -> Private Store.

External records may reference a canonical Knowledge ID. They should not be copied into this directory solely for integration.

## Entity direction

A canonical entity should evolve toward this shape:

```text
knowledge/<domain>/<CANONICAL-ID>/
  entity.yaml
  knowledge.md
  evidence.yaml
  review.yaml
  countries/
    cl.yaml
  regions/
    ...
  translations/
    es-CL.md
    ko.md
    en.md
```

Exact file schemas are versioned through Knowledge Platform contracts and validators. AI and humans propose revisions against a base version; production publication happens only after validation/review gates.

See `docs/KNOWLEDGE_SCOPE_BOUNDARY.md` for the content routing rules.
