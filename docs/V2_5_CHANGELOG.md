# v2.5 Changelog — 2026-09-16

Base: v2.4.

Implemented:
- Home now loads `/v1/home`
- Neighborhood loads `/v1/local/search`
- Business detail loads `/v1/business/{id}`
- quote action creates `/v1/care`
- Care screen loads `/v1/care/{id}`
- loading / empty / recoverable error UI
- explicit development location instead of hardcoded life area
- LAN HTTP allowed only in development for physical-device testing
- production/preview remain HTTPS-only
- Business/Care API detail client methods

Still NOT VERIFIED:
- Expo package install
- physical iPhone execution
- Expo SQLite durable offline queue
- MapLibre rendering
- Supabase live project/RLS
- Cloudflare deployment
- GitHub CI
