# Palta Cloudflare edge — Map + Public News preflight

Status: **CODE PREPARED / NOT DEPLOYED**

## Goal

Reuse Palta's existing Cloudflare edge and R2 infrastructure instead of creating duplicate Workers/buckets.

Current code prepares two read-only surfaces:

### Map

- `GET /health`
- `HEAD /maps/santiago.pmtiles`
- `GET /maps/santiago.pmtiles`
- `Range: bytes=...` → `206 Partial Content`

### Public News

- `GET|HEAD /v1/cl/news/home`
- `GET|HEAD /v1/cl/news/stories/{slug}`
- `GET|HEAD /v1/cl/news/comunas/{slug}`
- `GET|HEAD /v1/cl/news/regions/{slug}`
- `GET|HEAD /v1/cl/news/voices`

The News route-to-object mapping is centralized in `src/news/publicNewsRoutes.ts` and maps only into:

`public-news/v1/cl/news/...`

## Critical infrastructure rule

Do not create a new R2 bucket or Worker before inventorying the existing Cloudflare account.

The Wrangler template deliberately keeps the existing placeholder:

`__REUSE_EXISTING_R2_BUCKET_AFTER_INVENTORY__`

and does **not** add a `NEWS_PUBLIC` bucket binding yet. After inventory, bind `NEWS_PUBLIC` to a confirmed reusable public-content bucket rather than creating a duplicate.

## News double gate

Public News has a separate edge safety gate in addition to the engine/legal/owner gates.

Wrangler defaults to:

`NEWS_PUBLIC_ENABLED = "false"`

When false, all valid Public News API routes return 404 with reason `public_news_disabled`, even if stale objects somehow exist in R2. Object existence therefore cannot enable publication by itself.

If the edge gate is true but the `NEWS_PUBLIC` binding is missing, the Worker returns 503 with reason `public_news_storage_not_bound`.

If the gate/binding are valid but a requested approved object is absent, it returns 404 with reason `public_news_object_not_found`.

Do not set `NEWS_PUBLIC_ENABLED=true` during prototype/QA work.

## News object source

The Worker must never read raw collector/editorial data. It serves only the engine-generated public bundle:

```text
palta-engine/output/public-news/v1/cl/news/home.json
palta-engine/output/public-news/v1/cl/news/stories/{slug}.json
palta-engine/output/public-news/v1/cl/news/comunas/{slug}.json
palta-engine/output/public-news/v1/cl/news/regions/{slug}.json
palta-engine/output/public-news/v1/cl/news/voices.json
palta-engine/output/public-news/v1/cl/news/manifest.json
```

The engine removes stale local public output whenever publication gates are closed or no explicit owner approvals exist.

## News caching / HTTP semantics

Public News responses expose:

- `Content-Type: application/json`
- `ETag`
- conditional `If-None-Match` → `304`
- conservative edge/browser cache headers
- `X-Content-Type-Options: nosniff`
- CORS GET/HEAD/OPTIONS

The public HTTP contract is `infra/api/openapi.news-v1.yaml`.

## Map range and caching

The map Worker asks R2 with:

- `range: request.headers`
- `onlyIf: request.headers`

and returns `Accept-Ranges`, ETag, Content-Length and Content-Range.

Do not manually `cache.put()` a 206 response. Cloudflare Cache API rejects 206 responses.

After correctness is verified, configure the actual custom domain/Worker caching path and measure `CF-Cache-Status`. Range optimization should happen at Cloudflare's normal cache layer, not by inventing a second partial-response cache.

## Verification after account inventory

For map range behavior:

```bash
node scripts/verify-map-range.mjs https://<actual-map-host>
```

Map PASS requires:
- HEAD 200
- full Content-Length
- Accept-Ranges: bytes
- `Range: bytes=0-15` → 206
- exact Content-Range
- 16-byte body
- suffix range → 206

For News, first verify the Worker with `NEWS_PUBLIC_ENABLED=false`, then with a local/test R2 binding only. Production enablement requires separate owner/legal readiness and Cloudflare inventory confirmation.

No deployed URL is considered valid until these checks pass.
