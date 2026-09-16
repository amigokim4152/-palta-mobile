# Verification v4.3 — 2026-09-16

Core verify exit: 0

```text

> palta-app-prep-v4-3@2.3.0 verify
> npm run typecheck && npm test && npm run check:independence


> palta-app-prep-v4-3@2.3.0 typecheck
> tsc --noEmit


> palta-app-prep-v4-3@2.3.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v4-3@2.3.0 build
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
PASS: palta-app v3.2 data/event independence tests
PASS: palta-app v3.4 UI/UX policy tests
PASS: palta-app v3.5 screen integration policy tests
PASS: palta-app v3.6 secondary surface tests
PASS: palta-app v3.7 experience system tests
PASS: palta-app v3.8 reference UI policy tests
PASS: palta-app v3.9 feedback-port tests
PASS: palta-app v4.0 payment/commerce extensibility tests
PASS: palta-app v4.1 security/privacy foundation tests
PASS: palta-app v4.2 life-event exposure guidance tests
PASS: palta-app v4.3 service exchange / partner core tests

> palta-app-prep-v4-3@2.3.0 check:independence
> node scripts/check-core-independence.mjs

PASS: Palta core provider-independence scan


```

PASS when exit = 0:
- typecheck
- previous regression suites
- provider independence
- security/privacy foundation
- life-event guidance
- service-category quote routing
- sponsored/organic separation
- revenue guardrails
- partner capability progression

NOT VERIFIED:
- live provider routing
- provider quality metrics
- commercial pricing
- legal review of lead/transaction fees by category
- live partner APIs
