# v2.8 Changelog — 2026-09-16

Base: v2.7.

Integrated:
- actual Expo Location button into Neighborhood
- actual MapLibre NeighborhoodMap into screen when map style URL exists
- map movement → explicit 'Buscar en esta zona'
- separate search origin from effective/current life location
- PaltaSQLiteProvider at app root
- background-free mutation sync bootstrap on launch/foreground
- retryable quote failures persist to SQLite queue
- stable client mutation IDs
- Idempotency-Key on Care creation
- mutation executor replays quote with the same idempotency key
- mock API idempotency behavior + smoke verification

Still not activated:
- no final map style URL
- no Supabase live project
- no Cloudflare deployment
- no GitHub merge
