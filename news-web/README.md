# Palta News Web v1

Public-facing News surface for the Somos Palta ecosystem.

## Status

- Branch: `integration/news-web-v1`
- Public domain target: `news.somospalta.cl`
- Current state: **screen/data/edge contract implemented; not deployed**
- Engine publication gates: **closed**
- Edge publication gate: `NEWS_PUBLIC_ENABLED=false`
- Public R2 binding: **not configured until Cloudflare inventory is confirmed**
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

All fixtures are fictional demonstration content and remain disconnected from live publication.

## Runtime contracts

TypeScript contracts:

- `src/news/publicContracts.ts`
- `src/news/publicNewsRoutes.ts` — one API path ↔ R2 object-key rule
- `src/news/publicNewsClient.ts` — browser/client access restricted to `/v1/cl/news/...`
- `src/news/newsWebModel.ts` — presentation caps/grouping without changing canonical facts

Strict JSON schemas:

- `contracts/public-news-home-v1.schema.json`
- `contracts/public-news-story-v1.schema.json`
- `contracts/public-news-local-v1.schema.json`
- `contracts/public-news-voices-v1.schema.json`

HTTP contract:

- `../infra/api/openapi.news-v1.yaml`

The public runtime rejects internal editorial fields such as `risk_flags`, `editorial_state`, reviewer/AI notes and raw source extraction fields.

## Actual data path

```text
palta-engine News Core
        ↓
Korean operator/editorial review
        ↓
candidate_ready
        ↓
explicit owner public approval
        ↓
fail-closed Public Projection
        ↓
output/public-news/v1/cl/news/... JSON object bundle
        ↓
confirmed existing public-content R2 bucket
        ↓
existing Palta Cloudflare Worker
        ↓
/v1/cl/news/...
        ↓
PublicNewsClient
        ↓
News view models
        ↓
news.somospalta.cl screens
```

There is no direct `raw collector → News Web` path.

## Brief vs detail boundary

Home, comuna and region lists receive `PublicNewsBrief` only. They do not carry full article bodies or Local Voice contribution-only metadata.

Story endpoints receive `PublicNewsStory`. Full body is permitted only for Palta-owned/original, Deep Dive and explicitly approved Local Voice content. External summaries do not inherit source article body/excerpts.

Local Voices require explicit contributor attribution, perspective disclosure and media-rights state. They are not silently mixed into factual News lists.

## Publication safety

There are independent gates at two layers:

1. Engine gates: `legal_ready && public_publish_enabled` plus explicit owner approval.
2. Edge gate: Worker variable `NEWS_PUBLIC_ENABLED` must separately equal `true`.

When the engine gates close, stale local public bundles are deleted. When the edge gate is false, R2 object existence alone cannot expose News publicly.

Do not enable either gate during development/QA.

## Current Cloudflare boundary

News reuses the existing Palta edge Worker in `infra/cloudflare/src/index.ts`; it does not create a second Worker.

The `NEWS_PUBLIC` R2 binding is intentionally absent from the Wrangler template until the existing Cloudflare/R2 inventory is confirmed. Do not create a duplicate bucket merely for this feature.

## Local inspection

A static server is sufficient for the current HTML prototype:

```bash
python3 -m http.server 8788 -d news-web
```

Then open `http://127.0.0.1:8788`.

This is optional developer inspection only, not production deployment.

## Next implementation stage

1. Keep both engine/web CI green with the shared public contract.
2. Inventory the existing Cloudflare account and identify the correct reusable public-content R2 bucket/Worker deployment.
3. Add a local Worker fixture test for the R2 route adapter with `NEWS_PUBLIC_ENABLED=false/true` cases.
4. Replace static HTML fixture content with contract-driven rendering using `PublicNewsClient` and the existing view models.
5. Bind official Somos Palta brand assets.
6. Run responsive/accessibility/browser QA before any public deployment.
