# Verification v4.4 — 2026-09-16

## Core verification
Exit: 0

```text

> palta-app-prep-v4-4@2.4.0 verify
> npm run typecheck && npm test && npm run check:independence


> palta-app-prep-v4-4@2.4.0 typecheck
> tsc --noEmit


> palta-app-prep-v4-4@2.4.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v4-4@2.4.0 build
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

> palta-app-prep-v4-4@2.4.0 check:independence
> node scripts/check-core-independence.mjs

PASS: Palta core provider-independence scan


```

## Local preflight in packaging environment
Exit: 0

```text
PASS  git installed
PASS  node installed
PASS  npm installed
PASS  Node.js >= 22 (v22.16.0)
WARN  not currently inside a git repository
PASS  package.json present

Summary: PASS=5 WARN=1 FAIL=0


```

Packaging directory is intentionally not the user's final Git checkout, so repository warnings here are expected.

## Environment-boundary preflight
Exit: 0

```text
PASS EXPO_PUBLIC_PALTA_API_BASE_URL
WAIT EXPO_PUBLIC_SUPABASE_URL — not a blocker until that provider is connected
WAIT EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — not a blocker until that provider is connected
WAIT EXPO_PUBLIC_MAP_STYLE_URL — not a blocker until that provider is connected
PASS environment boundary preflight


```

NOT VERIFIED until computer session:
- actual GitHub branch/write permissions
- repository clean-state integration
- Expo shell runtime
- Cloudflare account/project
- Supabase project/RLS
- real native builds
- external API credentials
