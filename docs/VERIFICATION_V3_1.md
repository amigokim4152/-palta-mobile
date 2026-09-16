# Verification v3.1 — 2026-09-16

`npm run verify` exit: 0

```text

> palta-app-prep-v3-1@1.1.0 verify
> npm run typecheck && npm test && npm run check:independence


> palta-app-prep-v3-1@1.1.0 typecheck
> tsc --noEmit


> palta-app-prep-v3-1@1.1.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v3-1@1.1.0 build
> tsc

PASS: palta-app core regression tests
PASS: palta-app v2.3 adapter regression tests
PASS: palta-app v2.3 first vertical slice tests
PASS: palta-app v2.5 mobile API boundary tests
PASS: palta-app v2.6 location/offline core tests
PASS: palta-app v2.7 native adapter contract tests
PASS: palta-app v2.8 idempotency/retry tests
PASS: palta-app v2.9 range contract tests
PASS: palta-app v3 provider-independence tests
PASS: palta-app v3.1 auth/access/notification tests

> palta-app-prep-v3-1@1.1.0 check:independence
> node scripts/check-core-independence.mjs

PASS: Palta core provider-independence scan


```

PASS only if exit code = 0:
- typecheck
- regression tests
- provider-independence scanner

NOT VERIFIED:
- live auth provider
- live notification provider
- native notification permission/token
