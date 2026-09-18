# Palta Canonical Knowledge

This directory is the reviewable source layer for **durable public knowledge** used across Palta.

It is not a warehouse for every collected record, and it does not decide which final product surface owns every non-knowledge datum.

## Canonical domains

```text
knowledge/
  registry/      # domain and source registries
  food/          # food, species, varieties, selection, storage, preparation, nutrition, safety
  health/        # public health knowledge; personal health data never lives here
  pets/          # public species/breed/lifecycle/care knowledge; private pet records never live here
  education/     # durable learning/curriculum knowledge and concepts
  culture/       # durable cultural knowledge and explanation
  music/         # durable music knowledge and guides
  art/           # durable art knowledge and guides
  finance/       # durable financial concepts/guides
  clothing/      # durable apparel/material/care knowledge
  hobby/         # durable hobby knowledge and guides
```

Directories are materialized when the first canonical entity is added. The registry defines valid domains before every directory necessarily contains content.

## Two-axis classification

Every incoming datum should first answer two separate questions:

1. **Domain** — what is it about? (`food`, `health`, `pets`, `culture`, etc.)
2. **Content class** — what kind of datum is it? (`durable_knowledge`, `dynamic_observation`, `public_event`, etc.)

The content class does not determine the final user-facing surface. Projection to Home, Community, a specialist site, Search or another surface is a later decision.

Examples:

- Tomato storage guidance -> `domain=food`, `content_class=durable_knowledge`
- Tomato price today -> `domain=food`, `content_class=dynamic_observation`
- Museum history -> `domain=culture`, `content_class=durable_knowledge`
- Museum exhibition this Saturday -> `domain=culture`, `content_class=public_event`

## Boundaries that are already fixed

- Durable public knowledge -> canonical Knowledge source.
- News/editorial -> separate News system.
- User/family/health/pet private context -> Private Store.

## Boundaries that remain adjustable

The final infrastructure/service ownership for these classes is intentionally provisional:

- municipal/public benefits and application windows;
- cultural/public event schedules;
- institution opening/status/availability;
- current prices, supply and other changing observations.

They retain stable domain, source, canonical references, geographic scope and validity metadata so they can be rerouted later without rebuilding identity.

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

See `docs/KNOWLEDGE_SCOPE_BOUNDARY.md` for the current classification and routing policy.
