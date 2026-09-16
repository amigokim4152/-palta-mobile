# Cloudflare Map Edge v2.9 — 2026-09-16

## What is prepared

A correctness-first Worker for the existing Santiago PMTiles asset.

Flow:

`MapLibre → /maps/santiago.pmtiles → Worker → existing R2 object`

The Worker:
- supports GET/HEAD/OPTIONS
- forwards conditional/range headers to R2
- returns 206 for ranged R2 bodies
- exposes ETag / Accept-Ranges / Content-Range
- does not expose arbitrary bucket keys
- does not add write/delete endpoints

## Why this first

The prior map validation found the Worker path itself was the weak point. Before style work or map polish, HTTP Range must be provably correct.

## Caching decision

Cloudflare's Cache API cannot `put()` a 206 response.

Therefore:
1. prove R2 range correctness first
2. bind to the existing custom domain/route
3. use Cloudflare's cache configuration for full-object/range behavior
4. measure actual cache hits
5. only optimize further if R2 Class B requests become material

## Cost posture

No new provider and no new bucket is needed for this step.

The only required action at home is to inventory the existing Worker/R2 names and replace the placeholder binding with the real one.
