# Verification v2.7 — 2026-09-16

## Root/core TypeScript
Exit: 0

```text

> palta-app-prep-v2-7@0.8.0 typecheck
> tsc --noEmit



```

## Regression tests
Exit: 0

```text

> palta-app-prep-v2-7@0.8.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v2-7@0.8.0 build
> tsc

PASS: palta-app core regression tests
PASS: palta-app v2.3 adapter regression tests
PASS: palta-app v2.3 first vertical slice tests
PASS: palta-app v2.5 mobile API boundary tests
PASS: palta-app v2.6 location/offline core tests
PASS: palta-app v2.7 native adapter contract tests


```

## Native overlay syntax preflight
Exit: 0

```text
PASS /tmp/palta-v27/palta-app-prep-v2.6/mobile-overlay/src/adapters/expoLocationAdapter.ts
PASS /tmp/palta-v27/palta-app-prep-v2.6/mobile-overlay/src/adapters/expoSqliteMutationQueueStore.ts
PASS /tmp/palta-v27/palta-app-prep-v2.6/mobile-overlay/src/providers/PaltaSQLiteProvider.tsx
PASS /tmp/palta-v27/palta-app-prep-v2.6/mobile-overlay/src/components/map/NeighborhoodMap.tsx
PASS /tmp/palta-v27/palta-app-prep-v2.6/mobile-overlay/app.config.v2.7.template.ts


```

PASS only when exit code is 0:
- Expo permission/location normalization
- SQLite mutation row codec
- canonical MapFeature → GeoJSON projection

NOT VERIFIED until native dependencies are installed:
- Expo Location adapter against real SDK 57 package types/runtime
- Expo SQLite adapter against real SDK 57 package types/runtime
- MapLibre React Native native build/rendering
- physical iPhone permissions and SQLite persistence
