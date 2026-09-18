# Palta DEV Environment Bootstrap v1

Date: 2026-09-17
Status: ready up to external resource creation
Authority: `docs/PALTA_PLATFORM_RUNTIME_FOUNDATION_V1.md`

## Goal

Create one reproducible development environment that proves:

`committed mobile app → Palta API → canonical Postgres → Outbox/Queue → worker/provider adapter`

without using production credentials or creating parallel infrastructure.

## Gate 0 — already prepared

- Platform foundation branch exists.
- API namespace and storage ownership are defined.
- Module runtime boundaries are recorded in `config/module-runtime-boundaries.v1.json`.
- Public mobile env names are defined in `.env.example`.
- Payment provider certification readiness is recorded in `config/payment-provider-certification.v1.json`.
- Commerce/Payment Cloudflare runtime template exists.
- Payment card funding/installment persistence migration `0020` is prepared on `integration/commercial-core-v1` and has repository CI coverage; it is not yet applied to a real DB.

## Gate 1 — mobile source control

Before backend binding, inspect the existing local `apps/mobile` with:

```bash
bash scripts/check-mobile-runtime-promotion.sh
```

Then safely source-control the existing application. Do not create a second Expo app and do not commit local secrets/signing material/build caches.

Acceptance:
- safe `apps/mobile` source exists in Git;
- dependency manifest + one lockfile strategy are committed;
- clean checkout installs;
- iOS native Development Build runs from committed source;
- Android native Development Build is required before beta.

## Gate 2 — Supabase DEV project

External/cost-changing action. Must use the explicitly confirmed Supabase organization and current quoted project cost.

Target logical name: `palta-dev`
Target region: `sa-east-1` unless live creation constraints require a documented alternative.

After creation, record only non-secret identifiers in `config/runtime-environments.v1.json`.

Never commit DB password, service-role secret or owner connection string.

## Gate 3 — migration integration review

Before applying SQL:

1. integrate/review the current commercial-core migration head, including `0020_payment_card_evidence.sql`;
2. confirm ordered migration inventory;
3. inspect role/RLS assumptions against the real Supabase project;
4. confirm rollback/rebuild strategy for DEV;
5. inspect current Supabase changelog/documentation before security-sensitive implementation.

Do not mark migrations applied simply because files exist in Git.

## Gate 4 — apply and verify DEV database

Apply the reviewed migration sequence to DEV only.

Verify at minimum:
- schema objects and constraints;
- tenant/business RLS boundaries;
- API/worker role access;
- Commerce transaction atomicity;
- Payment idempotency/revision behavior;
- partial/card-evidence persistence;
- provider connection FK/business isolation;
- credential envelope storage/rotation/tamper rejection;
- Durable Outbox lease/retry behavior;
- printing/fiscal persistence;
- DB smoke tests;
- Supabase security advisor;
- Supabase performance advisor.

Any unexecuted test remains `NOT VERIFIED`.

## Gate 5 — Cloudflare DEV resources

Inventory existing Cloudflare account/resources first. Reuse existing map/public R2 path where appropriate.

Create/record only what DEV actually requires:
- Palta API Worker binding;
- Hyperdrive to DEV Postgres;
- payment queue;
- fiscal queue;
- notification queue;
- object/fiscal R2 resources or approved prefixes;
- external secret/KEK binding.

Record resource IDs/names in `config/runtime-environments.v1.json` but never secret values.

Existing `infra/cloudflare/` remains public map/data edge infrastructure.
Existing `infra/cloudflare-commerce/` remains Commerce/Payment/Fiscal trusted runtime.
Do not create duplicate Worker stacks solely for naming consistency.

## Gate 6 — first non-money vertical slice

Prove infrastructure with a low-risk flow before real payment sandbox:

`Home → Neighborhood/Business → confirmed action → Event/Care → Home`

Acceptance:
- native app uses Palta API base URL;
- authenticated identity works;
- canonical DB mutation persists;
- server authorization is enforced;
- Event/Care state can be read back;
- no provider secret exists in mobile bundle;
- degraded/error states are visible and retry-safe.

## Gate 7 — payment sandbox

Only after DB + secret boundary are verified:

1. acquire provider sandbox/certification access;
2. store merchant credentials through the encrypted credential boundary;
3. bind provider connection + terminal capability records;
4. verify one provider at a time;
5. record certification evidence in provider registry;
6. keep production connections blocked until provider/Palta release gates pass.

Initial provider order:
1. Transbank POS Integrado — because Chile in-person flow and recovery semantics are core.
2. Mercado Pago Point — adapter exists and public developer/test path exists.
3. Getnet POS Integrado — after technical/integrator documentation is obtained and adapter is implemented.

## Gate 8 — STAGING

Create only when DEV can be rebuilt repeatably.

STAGING must have separate DB/resources/secrets and production-like topology. It is the beta/provider-certification environment, not a renamed DEV environment.

## Current blockers

As of 2026-09-17:

- canonical local `apps/mobile` has not yet been promoted to GitHub;
- Supabase DEV project does not exist;
- migrations are not applied to real DEV Postgres;
- Cloudflare DEV runtime IDs are not inventoried/recorded;
- payment-provider sandbox credentials are not acquired;
- DB smoke tests against real Postgres are not verified;
- STAGING and PRODUCTION are not provisioned.
