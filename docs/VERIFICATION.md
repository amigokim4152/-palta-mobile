# Verification — palta-app-prep-v2.2

Checked: 2026-09-16

## PASS

- framework-neutral core TypeScript typecheck
- core regression tests
- Home sparse/busy behavior
- Care RESULT vs OUTCOME behavior
- location context separation
- eligibility suppression/recheck behavior
- Local Business controlled-offer guard: verified allowed / unverified rejected
- mobile overlay syntax transpile: 27 TS/TSX files
- route manifest parse
- OpenAPI preflight parse
- first mock vertical slice code path prepared:
  `Home → Neighborhood → Business → Quote/Care → Home`
- legacy `/activity/[id]` normalized to Care route alias
- static mobile structure prototype prepared
- brand runtime asset manifest resolved from Drive source-of-truth
- Neon fallback account verified: Free org `kim`, 0 projects, São Paulo region available

## NOT VERIFIED

- clean npm install in the real GitHub repository
- Expo native dependency resolution
- Expo development build
- physical iPhone navigation
- MapLibre rendering
- Push registration and deep-link delivery
- current Cloudflare Worker/R2 inventory
- currently deployed PMTiles HTTP Range 206 response
- Supabase development project creation
- DB migration / RLS policies
- GitHub Actions on the actual repository

`NOT VERIFIED` is never reported as PASS.


## v2.3 verification — 2026-09-16

PASS:
- TypeScript 5.8.3 `tsc --noEmit`
- core regression tests
- adapter regression tests
- first vertical slice orchestration tests
- Map Core browsing-state tests
- API auth-header/error-shape tests
- offline mutation retry/order tests
- Palta deep-link allow-list/round-trip tests
- runtime env HTTPS guard
- OpenAPI YAML parse
- Supabase access-boundary static guards

NOT VERIFIED:
- actual Supabase project/migration
- real RLS behavior with live JWTs
- actual Expo dependency install/native build
- MapLibre device rendering
- Cloudflare Worker/R2 integration
- GitHub CI

## v2.4 verification — 2026-09-16

PASS:
- v2.3 typecheck/regression suite remains green
- local mock API boot
- `/health`
- `/v1/home`
- `/v1/local/search`
- `/v1/business/{id}`
- `POST /v1/care`
- `/v1/care/{id}`
- end-to-end HTTP smoke: Home → Local Search → Business → Care

NOT VERIFIED:
- Expo app consuming the mock API on a physical iPhone
- Supabase live project/RLS
- Cloudflare deployment
- GitHub CI
