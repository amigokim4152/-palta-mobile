# v2.4 Changelog — 2026-09-16

Base: v2.3.

Added:
- zero-dependency Node 22 local mock API
- `/health`
- `/v1/home`
- `/v1/local/search`
- `/v1/business/{id}`
- `POST /v1/care`
- `/v1/care/{id}`
- end-to-end HTTP smoke script

Purpose:
- allow Expo shell development before Supabase/Cloudflare activation
- validate Palta API boundary without leaking provider SDKs into UI

Not production:
- no auth enforcement
- no persistence
- no real provider calls
