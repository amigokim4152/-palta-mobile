# Palta Platform Runtime Foundation v1

Date: 2026-09-17
Status: implementation contract
Branch: integration/platform-runtime-foundation-v1

## 1. Purpose

This contract turns the existing Palta domain modules and current native mobile runtime into one deployable product foundation.

The immediate goal is not to add more feature logic. The goal is to freeze where the app runs, where APIs terminate, where each data class is stored, how secrets are isolated, and how DEV/STAGING/PRODUCTION differ.

Existing feature branches remain independent until integration verification. `main` stays untouched.

## 2. Product runtime shape

```text
Palta iOS / Android app (Expo Router native app)
        |
        | HTTPS + authenticated Palta session
        v
api.somospalta.cl/v1
Cloudflare Worker API / Edge gateway
        |
        +--------------------------+
        |                          |
        v                          v
Canonical PostgreSQL          Cloudflare R2
(Supabase managed Postgres)   media / public snapshots /
        |                      fiscal artifacts
        |
        +--> Durable Outbox
                  |
                  v
          Cloudflare Queues
          payment / fiscal /
          notification / jobs
                  |
                  v
           provider workers
        Transbank / Getnet /
        Mercado Pago / SII / etc.

Device-local SQLite
  - cache
  - return/navigation state
  - explicitly allowed offline mutation journal
  - never global canonical truth
```

## 3. Canonical service choices

### Mobile application

- Runtime: Expo Router native application.
- A runnable Expo application already exists locally at `apps/mobile` and has been used by the iOS Simulator recovery/runtime workflow.
- As of 2026-09-17, `apps/mobile` is **not committed to this Git repository**. The repository-side `mobile-overlay` is a version-controlled recovery/reference layer, not the desired long-term application Source of Truth.
- Canonical target: sanitize and commit the existing `apps/mobile` source, package manifest/lockfile and safe configuration to GitHub. Do **not** create a second mobile app.
- Until that promotion is complete, `mobile-overlay` remains the recovery/reference source for verified route/component fragments.
- After promotion, feature work must target `apps/mobile`; `mobile-overlay` must not become a parallel application tree.
- MapLibre React Native requires a native development build; Expo Go is not an acceptance environment.
- Permanent primary navigation remains governed by `docs/APP_SHELL_ROUTE_CONTRACT.md`.

### Public API boundary

Canonical public API origin:

`https://api.somospalta.cl/v1`

Rules:

- Mobile/web clients call Palta APIs for business operations.
- Payment, fiscal, admin and provider credentials are never exposed to the client.
- Provider APIs such as Transbank, Getnet and Mercado Pago are called only from trusted workers/server runtime.
- Versioned API contracts must remain provider-neutral.
- Public/static high-volume data may be served directly from approved R2/edge endpoints when no private authorization or mutation is involved.

Initial logical API groups:

```text
/v1/auth/session
/v1/me
/v1/home
/v1/places
/v1/businesses
/v1/community
/v1/market
/v1/transport
/v1/events
/v1/commerce
/v1/payments
/v1/fiscal
/v1/notifications
```

The route list is a namespace contract, not permission to expose every database table as CRUD.

## 4. Storage ownership

### Supabase managed PostgreSQL — canonical transactional data

Development primary: one Supabase project in São Paulo (`sa-east-1`) after explicit project/cost approval.

Use PostgreSQL for:

- user/account linkage and profile state;
- business/organization/role/authorization records;
- Local Business canonical entities and mutable merchant data;
- Community canonical state requiring relational integrity;
- CommerceTransaction;
- PaymentIntent / PaymentEvent;
- provider connection records;
- encrypted merchant credential envelopes;
- POS register/session/device bindings;
- PrintJob / printer routing;
- FiscalRequest / FiscalDocument metadata / folio state;
- Event/Care lifecycle state;
- Durable Outbox;
- audit/security events that require relational querying.

Rules:

- Postgres is canonical truth for money/fiscal/business state.
- Multi-statement money/fiscal operations run through trusted server/worker DB transactions, not client Data API CRUD.
- RLS remains defense in depth; mobile/browser never receives direct grants to raw Commerce/Payment/Fiscal/credential tables.
- Schema stays portable PostgreSQL. Supabase-specific features must be behind adapters where practical.

### Supabase Auth — identity only

- Mobile may use the Supabase publishable key for authentication/session bootstrap.
- Authorization truth remains Palta business/role/capability records, not user-editable metadata.
- Service-role/secret keys never ship in the app.

### Cloudflare R2 — object/static storage

Use R2 for:

- images/media and normalized public assets;
- map/static snapshots and release artifacts;
- immutable fiscal XML/PDF/SII evidence;
- provider certification evidence that is safe to archive as files;
- large blobs that do not belong in transactional Postgres.

Database rows store provider-neutral object references + hashes/metadata rather than hard-coded public infrastructure URLs.

### Cloudflare Queues — asynchronous transport

Use separate logical queues/backpressure for at least:

- payment reconciliation/provider work;
- fiscal/SII work;
- notification/event delivery;
- non-critical background ingestion/jobs.

Queue payloads contain canonical IDs, not payment-card/tax/private payloads. Queue is never the only copy of pending work; Durable Outbox is canonical handoff.

### Secret/KMS boundary

Platform-wide secrets and KEKs live outside PostgreSQL/source/client configuration.

Merchant/provider credentials use the existing envelope design:

- encrypted credential payload in Postgres;
- random per-credential DEK;
- DEK wrapped by externally held KEK;
- plaintext only inside trusted payment worker execution;
- no one-secret-per-merchant Cloudflare resource model.

Do not commit access tokens, webhook secrets, private keys, SII certificate secrets, PAN/CVV/PIN or database owner credentials to GitHub.

### Device-local SQLite

Allowed:

- cache;
- navigation/return state;
- queued offline mutations where policy explicitly allows them;
- local register state required for degraded operation.

Not allowed as global truth:

- confirmed integrated card payment;
- authoritative inventory/accounting totals;
- final fiscal issuance state.

## 5. Environment separation

### LOCAL

Purpose: developer machine/simulator.

- API: localhost/dev worker
- DB: local fixtures or approved DEV connection
- payment: mocks/sandbox only
- fiscal: mocks/certification only
- no production credential access

### DEVELOPMENT

Purpose: shared engineering integration.

- dedicated Supabase DEV project/database
- dedicated DEV R2 prefixes/buckets
- dedicated DEV Queues
- provider sandbox credentials only
- synthetic/test data by default

### STAGING

Purpose: beta/certification environment mirroring production topology.

- separate database/resource identifiers from DEV and PROD
- provider sandbox/certification credentials unless provider explicitly requires controlled production certification
- native app builds distributed to beta testers
- production-like RLS, worker roles, queues, rate limits and observability

### PRODUCTION

Purpose: real users/money/fiscal operations.

- separate production database/resources/secrets
- production provider connections only when certification/contract state permits
- no DEV/STAGING secret fallback
- backup/restore, alerting and rollback gates required before release

No environment may select credentials solely from a client-provided environment value. Runtime bindings determine environment.

## 6. Resource naming contract

Preferred logical names; exact provider IDs are recorded in `config/runtime-environments.v1.json`.

```text
palta-dev
palta-staging
palta-prod

api.somospalta.cl

palta-<env>-payment
palta-<env>-fiscal
palta-<env>-notifications

palta-<env>-objects
palta-<env>-fiscal-archive
```

Existing public map/data R2 resources may remain separate when already operational; do not duplicate them solely for naming consistency.

## 7. Mobile Source-of-Truth promotion gate

The local `apps/mobile` becomes the canonical version-controlled mobile runtime only after these gates are satisfied:

1. verify the existing local `apps/mobile/package.json`, lockfile, Expo config and native app identifiers rather than creating a new project;
2. inspect the candidate source tree for secrets/local-only files and keep `.env*`, provider credentials, signing material, `node_modules`, build output and machine-specific artifacts out of Git;
3. commit the safe Expo application source/config/lockfile under `apps/mobile` on an integration branch;
4. verify a fresh checkout can install dependencies without relying on untracked local source;
5. verify the existing route contract renders and Back/return state works;
6. verify an iOS native Development Build from the committed tree;
7. verify an Android native Development Build from the committed tree before beta;
8. make Palta API client the default business-data boundary;
9. bind Supabase Auth using publishable client credentials only;
10. verify no provider/server secret appears in the mobile bundle/env;
11. verify MapLibre native build;
12. make offline cache/journal states visibly distinguishable from server-confirmed state;
13. verify crash/error telemetry redaction before beta;
14. remove any normal startup dependency on an untracked local-only `apps/mobile` state.

Until these gates pass, iOS Simulator success on the existing Mac proves the local runtime can execute, but it does **not** prove reproducible source-controlled application readiness.

## 8. API and database rule for concurrent feature branches

Every feature branch must declare:

- canonical entity/table ownership;
- API namespace/contract it needs;
- whether reads may be public/cached;
- whether mutation requires authenticated Palta API;
- whether it produces Event/Outbox work;
- object storage needs;
- secret/provider dependency;
- offline behavior;
- migration and rollback requirements.

Feature code must not create a parallel database/client/service merely because another branch has not yet been merged.

## 9. Payment provider certification registry

A provider connection is not `connected` merely because credentials exist.

For each provider + integration mode + terminal/platform combination record at least:

- provider and product/integration mode;
- sandbox access acquired;
- SDK/API/docs version/reference;
- required provider certification process;
- terminal model/firmware/platform when applicable;
- debit/prepaid/credit behavior;
- installment behavior;
- cancel/refund behavior;
- timeout/lost-response reconciliation;
- webhook duplicate/out-of-order behavior;
- offline behavior if explicitly supported;
- production credential gate;
- last verified date/evidence reference.

Unknown capability is never silently treated as supported.

## 10. Immediate execution order

1. Keep this branch as platform runtime Source of Truth; do not merge to `main` yet.
2. Promote the existing local `apps/mobile` into GitHub safely; do not create another app.
3. Create DEV Supabase project only after explicit organization + cost confirmation.
4. Apply and verify foundation migrations against DEV Postgres; draft/not-applied migrations stay NOT VERIFIED until then.
5. Create Cloudflare DEV runtime resources/bindings and record their IDs in runtime manifest.
6. Bind the committed mobile app to Palta API + Supabase Auth.
7. Connect one end-to-end non-money flow first to prove app/API/DB/storage boundaries.
8. Connect Commerce/Payment sandbox after persistence and secret boundaries are live.
9. Build STAGING only when DEV integration is repeatable.
10. Contact payment providers for sandbox/certification prerequisites before beta commercial negotiation.

## 11. Supersession note

This contract preserves the earlier low-cost choice from `AT_HOME_INFRA_CHECKLIST_V1`: Supabase is the first development Postgres/Auth service and Neon remains a portability/fallback option. It also incorporates the later Commerce runtime contract: Cloudflare Workers/Queues/R2 remain the edge/async/object layer and Postgres remains canonical transactional truth.

A future database provider change must not require changing Payment/Commerce domain contracts.
