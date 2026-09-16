# Verification v2.9 — 2026-09-16

## Root typecheck
Exit: 0

```text

> palta-app-prep-v2-9@0.10.0 typecheck
> tsc --noEmit



```

## Regression tests
Exit: 0

```text

> palta-app-prep-v2-9@0.10.0 test
> npm run build && node dist/tests/run-tests.js


> palta-app-prep-v2-9@0.10.0 build
> tsc

PASS: palta-app core regression tests
PASS: palta-app v2.3 adapter regression tests
PASS: palta-app v2.3 first vertical slice tests
PASS: palta-app v2.5 mobile API boundary tests
PASS: palta-app v2.6 location/offline core tests
PASS: palta-app v2.7 native adapter contract tests
PASS: palta-app v2.8 idempotency/retry tests
PASS: palta-app v2.9 range contract tests


```

## Cloudflare Worker syntax preflight
Exit: 0

```text
PASS: Cloudflare Worker syntax


```

PASS locally:
- offset/length range math
- suffix range math
- end-of-file clipping
- invalid range rejection
- Worker TypeScript syntax

NOT VERIFIED:
- Wrangler package/type resolution
- existing Cloudflare R2 binding name
- remote R2 HEAD/GET
- real PMTiles 206 response
- custom-domain cache behavior
- CF-Cache-Status
