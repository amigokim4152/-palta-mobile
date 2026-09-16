# v2.9 Changelog — 2026-09-16

Base: v2.8.

Infrastructure prep added:
- Cloudflare Worker module for existing Santiago PMTiles
- R2 GET/HEAD/Range handling
- CORS and conditional headers
- exact 206 Content-Range construction
- read-only public map route
- Wrangler template that intentionally refuses to guess/create a bucket
- live range verification script
- cache policy note: no Cache API put for 206 responses

No Cloudflare resource was created or changed.
