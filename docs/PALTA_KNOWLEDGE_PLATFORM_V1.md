# Palta Knowledge Platform v1

## Decision

Palta keeps one canonical Knowledge Core. Domains begin inside a shared Bodega/incubator and may later gain an independent public surface without copying or forking canonical data.

`Knowledge Core -> Bodega -> mature domain surface -> Palta Search/Home/Community`

## First principles

1. Prefer durable principles and mechanisms over chasing transient observations.
2. Current observations remain useful, but they attach to durable knowledge instead of replacing it.
3. Canonical general knowledge may be public/indexable.
4. Personalized/generated output, learner state, family context, health records, exact location and exposure history remain private/non-indexed.
5. AI never writes directly to production knowledge. AI creates a revision against an explicit base version.
6. Validation, review and publication are separate states. Rollback never erases history.
7. One Knowledge ID can appear in Bodega, an independent specialist site, Search, Community context and private Home projection.

## Knowledge shapes

Core knowledge kinds are `principle`, `mechanism`, `concept`, `guide`, `example`, `observation`, `application`, and `misconception`.

Relationships are first-class so Music, Art, Food, Health, Pets, Finance, Education and future domains can form a connected graph rather than a pile of articles.

## Bodega / domain graduation

Domain maturity is `seed -> growing -> mature -> standalone`.

Graduation is not automatic from article count. The decision also checks whether the domain has an independent question space, deep content, a connected graph, distinct navigation needs, search value, localization value and a sustainable review flow. A human decision is always required before creating a standalone surface.

Independent surfaces do not receive copied databases. They read the same canonical IDs.

## Education

Education is a cross-domain Learning Layer, not a duplicate knowledge silo. Curriculum tells Palta *when/where a concept is taught*; canonical Knowledge tells Palta *what the concept is*; the Learning Graph tells Palta *how a learner can understand and practice it*.

Learner progress is private. Curriculum and general concept knowledge are public.

## Publication flow

`AI/human -> draft revision -> base-version check -> schema/source/safety/privacy validation -> approval -> publish -> canonical.changed`

The existing Palta Event Core then allows Search, static snapshots, specialist sites and relevance evaluation to react without provider coupling.
