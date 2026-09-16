# v2.3 Changelog — 2026-09-16

Base: v2.2.

Added:
- Map Core adapter contract
- Palta API client
- offline mutation queue
- Palta deep-link parser
- runtime environment validator
- Supabase explicit GRANT + RLS access-boundary draft
- Supabase access-model documentation

Security direction:
- canonical public facts: read-only from public clients
- private Home/Care: signed-in owner read only
- side-effecting writes: Palta API/server mediated in v1
- service_role never in mobile client

Not executed:
- no Supabase project created
- no migration applied
- no service credentials generated
- no Cloudflare resource changed
- no GitHub merge
