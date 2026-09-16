# Palta development start runbook

## Goal

Start development from one computer without merging unfinished foundations into `main`, while keeping every future provider replaceable.

## Session 0 — machine readiness

Install/confirm:
- Git
- Node.js 22+
- npm
- a code editor
- GitHub authentication

Then run:

```bash
./scripts/preflight-local.sh
npm ci
npm run verify
```

Expected result: no FAIL.

## Session 1 — repository safety

Target:
`integration/foundation-authorization-policy-v1`

Rules:
- do not merge to `main`
- do not overwrite existing work blindly
- verify file count/checksum before applying a prep package
- commit foundation separately from provider setup

## Session 2 — mobile shell

Run the guarded bootstrap only after repository safety checks:

```bash
./scripts/bootstrap-mobile.sh
```

Then intentionally apply/review `mobile-overlay/`.

First routes to inspect:
- `/reference`
- `/reference/home`
- `/reference/neighborhood`
- `/reference/business`
- `/reference/care`
- `/reference/reading`

Do not connect a real backend just to judge basic UI.

## Session 3 — first real vertical slice

Use the smallest end-to-end slice:

**Home → Neighborhood → Business → Care**

Keep the mock API available until the real API satisfies the same canonical contracts.

## Session 4 — Auth/DB

Only now activate the chosen Auth/Postgres provider.

Requirements before accepting it:
- public client key only on device
- privileged secrets server-side
- RLS/tenant isolation
- deny-by-default tests
- account/session recovery plan

## Session 5 — Edge/API/R2

Activate Cloudflare when a real external data/API/storage path is needed.

Keep:
- Worker adapter boundary
- R2/object storage adapter boundary
- caching/ETag
- no provider credentials in app bundle

## Session 6 — external APIs

Integrate one provider at a time through a canonical adapter.

Examples:
- public/local data
- transport
- partner services
- payment later

A provider outage must not redefine Palta canonical IDs.

## Session 7 — payments

Do not begin with direct custody.

Start:
- canonical Order
- PaymentIntent
- external PSP adapter
- webhook verification
- idempotency
- refund/reconciliation tests

Only then consider fees/settlement/deeper financial capability.

## Definition of "not blocked"

Development can continue locally when:
- a provider account is not yet created
- an API key is pending
- external data is temporarily unavailable
- native haptic/TTS is not yet device-tested

Use:
- mock adapters
- fixtures
- explicit `NOT VERIFIED`
- interface contracts

Never fake PASS for an unavailable integration.
