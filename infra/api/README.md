# Palta API preflight

This API exists to keep mobile development independent from provider timing.

First slice:

`Home → Neighborhood → Business → confirmed action → Care → Home`

Rules:
- mobile consumes Palta API/contracts, not DTPM/municipality/provider APIs directly
- provider credentials never ship in the app
- public/canonical data and private personalization remain separable
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
