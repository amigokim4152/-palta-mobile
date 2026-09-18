# Palta DB preflight

Runtime authority: `docs/PALTA_PLATFORM_RUNTIME_FOUNDATION_V1.md`.

Primary v1 development provider remains **Supabase managed PostgreSQL**. Neon remains a portability/fallback option; do not operate both as parallel canonical databases for v1.

## Current status — 2026-09-18

- Supabase DEV project: **PROVISIONED / ACTIVE_HEALTHY**;
- project: `palta-dev`;
- project ref: `rqbpbauhkdgsrkbwmkmg`;
- region: `sa-east-1` (São Paulo);
- plan/cost at creation: Free / project creation cost reported as 0 monthly;
- migrations `0001` through `0022`: **APPLIED to DEV** through the Supabase migration API;
- `0020_payment_card_evidence.sql` is now integrated on this foundation branch as well as the commercial source branch;
- payment card evidence columns verified in DEV: `card_funding_type`, `installment_count`, `installment_amount_minor`, plus `processed_amount_minor`, `provider_connection_id`, and `order_id`;
- direct `anon` / `authenticated` SELECT privilege on `payment_intent` and `payment_credential_envelope`: **false**;
- failed role-switch smoke test left **0 synthetic fixture rows**;
- full business-role RLS isolation smoke: **NOT VERIFIED YET** because the Supabase administrative SQL connection is not a member of `palta_commerce_api` and cannot `SET ROLE` to it;
- production database: **NOT PROVISIONED**.

`NOT VERIFIED` must never be reported as PASS.

## Advisor status

### Performance

After migrations `0021` and `0022`:

- prior unindexed foreign-key findings: cleared;
- prior business-policy `auth_rls_initplan` findings: cleared by the private `palta_private.current_business_id()` helper;
- remaining `unused_index` notices are expected on a new empty DEV database and are not a reason to remove indexes before measured workload exists.

### Security

Palta application tables are RLS-protected according to the current access contracts. Remaining advisor findings are PostGIS-extension placement findings created because migration `0001` installed PostGIS in `public`:

- `public.spatial_ref_sys` reported without RLS;
- PostGIS extension reported in `public`;
- `st_estimatedextent` SECURITY DEFINER overloads reported executable by client roles.

PostGIS 2.3+ is not safely relocatable after dependent geography objects exist. Do **not** use `DROP EXTENSION ... CASCADE` on this DEV database merely to silence the advisor. Before STAGING/PRODUCTION, create the clean baseline with PostGIS under the supported non-public extension schema or use the supported Supabase migration/support path.

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

The mobile app may receive only the Supabase project URL and the active **publishable** client key needed for Auth/session bootstrap. Database owner credentials, service-role/secret keys, provider tokens, KEKs and fiscal credentials never enter the client or GitHub.

## Current next gates

1. Inventory the existing Cloudflare account/resources before creating any duplicate Worker/R2/Queue resource.
2. Create DEV runtime bindings only for missing resources and record their real IDs in `config/runtime-environments.v1.json`.
3. Create environment-specific login principals/member roles for `palta_commerce_api`, payment/fiscal workers and dispatcher through the approved runtime-secret path.
4. Re-run the business-role isolation smoke using the actual runtime principal.
5. Verify credential-envelope encrypt/read/rotate/tamper behavior against the real Worker secret/KEK boundary.
6. Promote the existing local `apps/mobile` runtime into source control after the secret/generated-file preflight.
7. Bind mobile Auth with the Supabase publishable key only after the committed app runtime is ready.
8. Connect one non-money end-to-end vertical before Payment sandbox.

## Portability rule

Keep core schema and domain contracts PostgreSQL-oriented. Supabase-specific capabilities should remain behind adapters/policies where practical so moving to another PostgreSQL provider does not force Payment/Commerce domain redesign.
