# Palta API preflight

This API exists to keep mobile development independent from provider timing.

Vertical slices:

`Home → Neighborhood → Business → confirmed action → Care → Home`

`Community tab → Community Space → thread → join/comment/reaction → Event/Notification/Home projection`

Rules:
- mobile consumes Palta API/contracts, not DTPM/municipality/provider APIs directly
- provider credentials never ship in the app
- authenticated identity is resolved from the bearer session; mutation payloads never choose `person_id` / `palta_user_id`
- public/canonical data and private personalization remain separable
- Community reads and writes pass membership, audience and moderation authorization server-side
- Community mutations use idempotency receipts and a transactional outbox before Event/Notification/Home projection
- Home and Push delivery are separate decisions
- `RESULT != OUTCOME`
- a business is canonical and reused across map/search/detail/care
- this preflight contract may evolve before production freeze

Implementation order:
1. mock adapter
2. local Worker/API adapter
3. Supabase development database
4. Cloudflare edge/cache/API boundary
5. real canonical releases

Persistence:
- `infra/db/migrations` is the canonical shared database migration sequence.
- `0003_community_preflight.sql` defines the Community persistence foundation.
- `infra/postgres` is auth/profile work awaiting reconciliation into the canonical migration sequence; it is not a second production database.
- mobile clients do not write Community persistence directly; mutations enter through the authenticated Palta API.
