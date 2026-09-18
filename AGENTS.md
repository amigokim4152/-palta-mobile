# Somos Palta Play discovery Source of Truth

This branch is the Source of Truth for the mobile `Play / Panoramas` discovery surface.

Before changing mobile-visible behavior, also read from `integration/runtime-composition-v1`:

- `docs/MOBILE_RUNTIME_COMPOSITION.md`
- `manifest/mobile-runtime-composition.json`
- repository-global GitHub Issue #9: `[Source of Truth] Mobile runtime composition for parallel feature work`

Repository-wide rules also live in `AGENTS.md` on `main`.

## Owned paths

This branch may own and advance:

- `mobile-overlay/src/features/play`
- `mobile-overlay/src/app/(tabs)/play.tsx`
- `src/play`

It does **not** own the shared tab layout, theme, Map Core, Search Core, Location Core, Care Core, Messaging, Commerce, Localization, or generated `apps/mobile/src` output.

## Product direction

Play answers: **what can I do with my time?**

The initial Chile/Santiago discovery hierarchy is:

1. official municipal/public events and programs as the stable content floor,
2. user-intent themes such as today, weekend, family, free, outdoor, and birthday,
3. canonical places/businesses and eventual reservation/contact actions,
4. shared Map Core for spatial discovery.

Do not reproduce Municipalidad department menus in the UI. Project one canonical event/program into multiple useful themes instead.

Birthday is an occasion/theme, not a duplicate Business or Place entity.

Development preview fixtures must remain explicitly scoped to development and must never appear as verified production events.

## Integration

The whole-app simulator/review remains `integration/runtime-composition-v1`.

Do not edit `apps/mobile/src` as Source of Truth and do not merge to `main` merely to make Play visible in the simulator.
