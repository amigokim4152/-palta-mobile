# Palta Cloudflare edge preflight — v2.9

Status: CODE PREPARED / NOT DEPLOYED

## Goal

Reuse the existing Palta/legacy R2 map object and make PMTiles byte-range reads correct before connecting the mobile MapLibre client.

Prepared route:

- `GET /health`
- `HEAD /maps/santiago.pmtiles`
- `GET /maps/santiago.pmtiles`
- `Range: bytes=...` → `206 Partial Content`

## Critical rule

Do not create a new R2 bucket or Worker before inventorying the existing Cloudflare account.

The Wrangler file deliberately contains:

`__REUSE_EXISTING_R2_BUCKET_AFTER_INVENTORY__`

## Range and caching

The Worker asks R2 with:

- `range: request.headers`
- `onlyIf: request.headers`

and returns `Accept-Ranges`, ETag, Content-Length and Content-Range.

Do not manually `cache.put()` the 206 response. Cloudflare Cache API rejects 206 responses.

After correctness is verified, configure the actual custom domain/Worker caching path and measure `CF-Cache-Status`. Range optimization should happen at Cloudflare's normal cache layer, not by inventing a second partial-response cache.

## Verification after account inventory

```bash
node scripts/verify-map-range.mjs https://<actual-map-host>
```

PASS requires:
- HEAD 200
- full Content-Length
- Accept-Ranges: bytes
- `Range: bytes=0-15` → 206
- exact Content-Range
- 16-byte body
- suffix range → 206

No deployed URL is considered valid until this script passes.
