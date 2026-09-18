# Palta Cloudflare edge preflight — v2.10

Status: CODE PREPARED / NOT DEPLOYED

## Goal

Reuse existing Palta/legacy Cloudflare resources before creating anything new, then make PMTiles byte-range reads correct before connecting the mobile MapLibre client.

Prepared map route:

- `GET /health`
- `HEAD /maps/santiago.pmtiles`
- `GET /maps/santiago.pmtiles`
- `Range: bytes=...` → `206 Partial Content`

## Critical rule

Do not create a new R2 bucket, Worker, Queue or Hyperdrive configuration before inventorying the existing Cloudflare account.

The map Wrangler file deliberately contains:

`__REUSE_EXISTING_R2_BUCKET_AFTER_INVENTORY__`

## Read-only account inventory

The inventory script performs **GET requests only** and lists existing:

- Workers
- R2 buckets
- Queues
- Hyperdrive configurations

It never creates, updates, deploys or deletes resources. It also does not print the API token, account ID, Hyperdrive origin, database host or credentials.

Required environment variables:

```bash
export CLOUDFLARE_API_TOKEN='...'
export CLOUDFLARE_ACCOUNT_ID='...'
node infra/cloudflare/scripts/inventory.mjs
```

Use a Cloudflare API token with only the read permissions needed for the inventory:

- Workers Scripts Read
- Workers R2 Storage Read
- Queues Read
- Hyperdrive Read

Run this locally/manual only. Do **not** add it to public GitHub Actions because Cloudflare resource names should not be copied into public CI logs.

A partial permission failure is reported as `INCOMPLETE`; it must not be treated as an empty account.

## Range and caching

The Worker asks R2 with:

- `range: request.headers`
- `onlyIf: request.headers`

and returns `Accept-Ranges`, ETag, Content-Length and Content-Range.

Do not manually `cache.put()` the 206 response. Cloudflare Cache API rejects 206 responses.

After correctness is verified, configure the actual custom domain/Worker caching path and measure `CF-Cache-Status`. Range optimization should happen at Cloudflare's normal cache layer, not by inventing a second partial-response cache.

## Verification after account inventory

```bash
node infra/cloudflare/scripts/verify-map-range.mjs https://<actual-map-host>
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
