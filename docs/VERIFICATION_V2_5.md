# Verification v2.5 — 2026-09-16

## Root shared/core

Typecheck exit: 0

```text

> palta-app-prep-v2-5@0.6.0 typecheck
> tsc --noEmit



```

Test exit: 0

```text

> palta-app-prep-v2-5@0.6.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v2-5@0.6.0 build
> tsc

PASS: palta-app core regression tests
PASS: palta-app v2.3 adapter regression tests
PASS: palta-app v2.3 first vertical slice tests
PASS: palta-app v2.5 mobile API boundary tests


```

Mock HTTP smoke exit: 0

```text

> palta-app-prep-v2-5@0.6.0 mock:smoke
> node dev/mock-api/smoke.mjs

PASS: Palta mock API HTTP smoke
{
  "homeItems": 2,
  "localItems": 2,
  "businessId": "biz-taller-1",
  "careId": "care-6872c211-6a8e-4c19-8195-e17619b40f65"
}


```

## Mobile overlay

Implemented but NOT fully compiled as an Expo app in this staging environment because Expo/React Native packages are intentionally not installed here.

NOT VERIFIED:
- Expo dependency resolution
- physical iPhone run
- MapLibre native module
- durable Expo SQLite queue
