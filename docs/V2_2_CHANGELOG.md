# v2.2 Changelog — 2026-09-16

Base: Drive Source of Truth package `palta-app-prep-v2.1.zip`.

Merged without changing the v2.1 Supabase-first provider decision:

- Home implementation contract
- Neighborhood spatial implementation contract
- Local Business detail/action/verification contract
- Navigation/state ownership contract
- Secondary surface minimum contracts
- First vertical slice acceptance gates
- Brand runtime asset binding
- Component registry
- API preflight OpenAPI contract
- provider-neutral Postgres/PostGIS schema draft for Supabase dev
- static mobile structure prototype
- richer mobile overlay components/state/reducers
- business controlled-offer verification guard
- Neon fallback status updated to connected Free org / 0 projects / São Paulo available

Not executed:
- no Supabase project creation
- no Neon project creation
- no migration
- no Cloudflare resource creation
- no GitHub merge
- no native Expo build

- mobile overlay route topology normalized to the documented App Shell contract
- executable mock navigation flow added: Neighborhood → Business → Care → Home
- Neighborhood state provider/reducer wired into overlay
- duplicate `/search` route removed
- tabs normalized to Inicio / Barrio / Comunidad / Mercado / Panoramas
- Core + overlay + OpenAPI verification rerun successfully
