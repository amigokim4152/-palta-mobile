# Verification v4.5 — 2026-09-16

## Core
Exit: 0

```text

> palta-app-prep-v4-5@2.5.0 verify
> npm run typecheck && npm test && npm run check:independence


> palta-app-prep-v4-5@2.5.0 typecheck
> tsc --noEmit


> palta-app-prep-v4-5@2.5.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v4-5@2.5.0 build
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

> palta-app-prep-v4-5@2.5.0 check:independence
> node scripts/check-core-independence.mjs

PASS: Palta core provider-independence scan


```

## Machine check script test in packaging environment
Exit: 0

```text
=== PALTA MACHINE READINESS ===

OS:   Linux
ARCH: x86_64

--- Core tools ---
PASS  git 2.47.3
PASS  node v22.16.0
PASS  npm 10.9.2
PASS  npx available
PASS  Node major version >= 22

--- Recommended developer tools ---
WARN  VS Code CLI not found
WARN  GitHub CLI not found
WARN  Watchman not found (recommended on macOS for React Native)
PASS  python3 Python 3.13.5

--- Android tools ---
WARN  ANDROID_HOME not set (not a blocker until Android native/simulator work)
WARN  adb not found
PASS  Java available

--- GitHub status ---
WARN  Use browser/Git credential auth or install GitHub CLI

--- Disk ---
overlay          32G   14M   30G   1% /

--- Optional provider CLIs (NOT required on day zero) ---
WARN  Wrangler not installed — install when Cloudflare work starts
WARN  Supabase CLI not installed — install when Auth/DB work starts
WARN  EAS CLI not installed — install when EAS build workflow starts

=== SUMMARY ===
PASS=7 WARN=9 MISS=0

RESULT: CORE DEVELOPMENT READY


```

The actual computer must run the same script again. This package cannot verify that machine remotely.

NOT VERIFIED until the real computer session:
- GitHub write permission
- actual repository branch/state
- Xcode/Android native tooling on that computer
- Expo runtime
- physical-device testing
