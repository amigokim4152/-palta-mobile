# Somos Palta Mercado branch handoff

This branch is the Source of Truth for the Palta Mercado mobile surface and Mercado-specific contracts.

Before changing mobile-visible behavior, read the repository-wide contract:

- `AGENTS.md` on `main`
- `docs/MOBILE_RUNTIME_COMPOSITION.md` on `integration/runtime-composition-v1`
- `manifest/mobile-runtime-composition.json` on `integration/runtime-composition-v1`
- repository-global GitHub Issue #9: `[Source of Truth] Mobile runtime composition for parallel feature work`

## Owned scope

- `mobile-overlay/src/features/market`
- `mobile-overlay/src/app/(tabs)/market.tsx`
- `mobile-overlay/src/app/market`
- `src/market`
- Mercado-specific tests/docs added by this workstream

## Product boundary

Mercado v1 is neighborhood person-to-person goods: sell, give away, exchange and wanted posts.
Vehicles, property and jobs/services are separate Palta verticals and must not be folded into Mercado merely because they can be listed.

## Rules

- Inspect existing implementation before changing it; do not recreate parallel Mercado screens.
- Do not hand-edit `apps/mobile/src`; it is generated runtime output.
- Do not modify shared tab layout, theme, API client or shared runtime scripts from this branch.
- Do not duplicate Messaging, Auth/Profile, Map, Media, Payment, Care, Notification or other Shared Cores.
- Development preview listings must remain clearly development-scoped; production must not silently fall back to fake listings.
- Whole-app simulator/review belongs to `integration/runtime-composition-v1`.
- Do not merge Mercado work to `main` merely to make it visible in the simulator.
