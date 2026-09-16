# Verification v2.8 — 2026-09-16

## Root/core typecheck
Exit: 0

```text

> palta-app-prep-v2-8@0.9.0 typecheck
> tsc --noEmit



```

## Regression tests
Exit: 0

```text

> palta-app-prep-v2-8@0.9.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v2-8@0.9.0 build
> tsc

PASS: palta-app core regression tests
PASS: palta-app v2.3 adapter regression tests
PASS: palta-app v2.3 first vertical slice tests
PASS: palta-app v2.5 mobile API boundary tests
PASS: palta-app v2.6 location/offline core tests
PASS: palta-app v2.7 native adapter contract tests
PASS: palta-app v2.8 idempotency/retry tests


```

## Mobile overlay syntax
Exit: 0

```text
PASS: mobile overlay syntax (40 files)


```

## Mock API HTTP smoke
Exit: 0

```text

> palta-app-prep-v2-8@0.9.0 mock:smoke
> node dev/mock-api/smoke.mjs

PASS: Palta mock API HTTP smoke
{
  "homeItems": 2,
  "localItems": 2,
  "businessId": "biz-taller-1",
  "careId": "care-e5ea4dbd-edfc-45d1-84a3-04680b612a12"
}


```

Current interpretation:
- PASS only where exit code = 0.
- Native Expo/MapLibre package type resolution is still NOT VERIFIED.

NOT VERIFIED:
- actual Expo SDK 57 dependency installation/type resolution
- physical iPhone Location permission
- SQLite persistence after real app termination
- MapLibre native rendering with Palta R2 style
- production idempotency storage
- Supabase / Cloudflare / GitHub CI
