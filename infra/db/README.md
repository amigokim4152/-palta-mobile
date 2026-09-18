# Palta DB preflight

Runtime authority: `docs/PALTA_PLATFORM_RUNTIME_FOUNDATION_V1.md`.

Primary v1 development provider remains **Supabase managed PostgreSQL**. Neon remains a portability/fallback option; do not operate both as parallel canonical databases for v1.

## Current status — 2026-09-17

- connected Supabase organization: available;
- Supabase projects: **0**;
- development database: **NOT PROVISIONED**;
- migrations `0001` through `0019`: present on this foundation branch, **NOT APPLIED to a verified DEV database**;
- payment card-funding/installment persistence migration `0020_payment_card_evidence.sql`: prepared on `integration/commercial-core-v1` at/through commit `98ac65a9e12d2b47e3e245900857735f13edb858`, **NOT YET INTEGRATED into this foundation branch and NOT APPLIED to DEV**;
- production database: **NOT PROVISIONED**.

`NOT APPLIED` and `NOT VERIFIED` must never be reported as PASS.

## What belongs in canonical Postgres

- identity linkage/profile references;
- business/organization/authorization state;
- canonical mutable business/community entities requiring relational integrity;
- CommerceTransaction and PaymentIntent/PaymentEvent;
- payment provider connections and encrypted credential envelopes;
- POS/register/printer/PrintJob state;
- FiscalRequest/FiscalDocument/folio metadata;
- Event/Care lifecycle state;
- Durable Outbox;
- relational audit/security records.

Large media/static releases/fiscal files belong in the approved R2/object layer, not as DB blobs by default.

## Application rule

Mobile/browser clients do not directly operate raw Commerce/Payment/Fiscal/credential tables. Money/fiscal multi-statement changes execute through trusted Palta API/worker database transactions. RLS remains defense in depth.

## Migration rule

The SQL under `infra/db/migrations/` is source-controlled schema intent until it has been executed and verified against the designated DEV database.

Do not apply the migration sequence until:

1. the existing `apps/mobile` runtime promotion boundary is understood;
2. the Supabase DEV project is deliberately created after organization/current-cost confirmation;
3. Auth/RLS and server-role boundaries are reviewed;
4. public canonical data vs private user/business data boundaries are explicit;
5. commercial-core `0020` card-evidence persistence is integrated into the chosen DEV migration sequence;
6. an application/rollback/test order is documented for the full migration set.

After DEV project creation:

1. inspect current Supabase changelog/docs before DB/security implementation;
2. integrate/review the current commercial-core migration head before applying DB changes;
3. apply/iterate schema in DEV using the approved Supabase workflow;
4. run security + performance advisors;
5. run repository DB smoke/RLS/role tests including card-evidence persistence;
6. verify payment credential envelope encrypt/read/rotate/tamper behavior against real runtime;
7. only then mark migrations verified and prepare a clean migration history.

## Portability rule

Keep core schema and domain contracts PostgreSQL-oriented. Supabase-specific capabilities should remain behind adapters/policies where practical so moving to another PostgreSQL provider does not force Payment/Commerce domain redesign.
