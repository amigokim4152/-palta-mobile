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
3. Neon dev branch
4. Cloudflare edge/cache
5. real canonical releases

Persistence:
- `infra/postgres/001_auth_profile_core.sql` owns canonical Palta identity/profile storage.
- `infra/postgres/002_community_core.sql` defines the Community persistence boundary.
- mobile clients never connect directly to `palta_private` or `palta_community` schemas.
