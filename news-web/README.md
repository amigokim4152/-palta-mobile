# Palta News Web v1

Public-facing News prototype for the Somos Palta ecosystem.

## Status

- Branch: `integration/news-web-v1`
- Public domain target: `news.somospalta.cl`
- Current state: **prototype / mock only**
- Public publication gate: **closed**
- Raw collector/editorial files: **never consumed directly**

## Prototype screens

- `index.html` — News home
- `comuna.html` — comuna/living-area page (Vitacura demo)
- `story.html` — standard story detail
- `deep-dive.html` — evidence-led Deep Dive structure
- `voices.html` — Local Voices / community contributions

`styles.css` is a neutral validation layer. It follows Palta spacing/radius/typography semantics but does not freeze brand color or recreate official logo assets.

## Public data fixtures

- `mock/home.json`
- `mock/story.json`
- `mock/comuna-vitacura.json`
- `mock/voices.json`

All fixtures are fictional demonstration content and must remain disconnected from live publication.

## Contracts

TypeScript source of truth:

- `src/news/publicContracts.ts`

Strict JSON schemas:

- `contracts/public-news-home-v1.schema.json`
- `contracts/public-news-story-v1.schema.json`

The runtime contract rejects internal editorial fields such as `risk_flags`, `editorial_state`, reviewer/AI notes and raw source extraction fields.

## Intended production flow

`Palta News Core → approved public projection → Cloudflare Worker/cache → News Web`

Never:

`raw collector → News Web`

## Local inspection

A static server is sufficient for the prototype:

```bash
python3 -m http.server 8788 -d news-web
```

Then open `http://127.0.0.1:8788`.

This command is for optional developer inspection only; it is not a production deployment.

## Next implementation stage

1. Build the fail-closed public projection exporter in `palta-engine`.
2. Produce API-shaped approved projection files without enabling public publication.
3. Add a Cloudflare Worker contract adapter/cache layer.
4. Bind official Somos Palta brand assets at runtime.
5. Replace static mock rendering with projection-driven rendering.
6. Run responsive/accessibility/browser QA before any public deployment.
