# Palta Commerce Runtime Infrastructure Contract v1

Date: 2026-09-17
Status: implementation contract
Scope: independent Palta POS / Payment / Chile Fiscal runtime. Base44 is not a runtime dependency.

## 1. Definition of done

A Commerce feature is not complete because its happy path works.

For POS / Payment / Fiscal, completion requires all of the following:

1. canonical state is durably persisted;
2. duplicate requests are safe through idempotency;
3. external-provider timeout/unknown states have an explicit reconciliation path;
4. one provider outage does not unnecessarily stop unrelated business operations;
5. user-visible degraded states explain what happened and whether the user should retry;
6. queue/retry/dead-letter behavior is defined;
7. authorization, audit and secret boundaries are enforced;
8. latency/backlog/error metrics exist;
9. backup and restore behavior is tested before production;
10. cost/usage limits are measured before adding paid infrastructure.

## 2. Runtime ownership

```text
POS / Mobile / Web
        |
        v
Palta API / Edge
        |
        v
Transactional Postgres
  |-- CommerceTransaction
  |-- PaymentIntent / PaymentEvent
  |-- POS Register / Session
  |-- FiscalRequest / FiscalDocument
  |-- Folio reservation
  |-- Audit events
  `-- Durable Outbox
          |
          v
 Async transport / Queue
   |-- payment reconciliation
   |-- fiscal send/status
   `-- notifications
          |
          v
Provider adapters
Mercado Pago / Transbank / SII / others

Fiscal XML/PDF/evidence -> object archive (R2/S3-compatible)
```

### Postgres
Postgres is the canonical transactional truth.

- A transaction mutation and the outbox events created by that mutation MUST commit in one database transaction.
- Optimistic revisions / unique constraints MUST prevent silent lost updates.
- Provider callback data is normalized before canonical state changes.
- The queue is never the only copy of pending work.

### Durable Outbox
The database Outbox is the durable handoff between synchronous transaction state and asynchronous work.

- outbox creation is atomic with the canonical state change;
- a dispatcher may publish the same outbox item more than once;
- consumers MUST therefore remain idempotent;
- an outbox item is marked delivered only after the downstream responsibility has durably accepted it;
- oldest-pending age is an operational alert.

### Async queue
A queue is a throughput/backpressure transport, not canonical truth.

Current first candidate: Cloudflare Queues, behind a Palta transport contract.

Rules:
- at-least-once delivery is assumed;
- duplicate delivery MUST be harmless;
- payment reconciliation and Chile Fiscal work SHOULD use separate queues/backpressure controls;
- queue outage MUST NOT erase work already committed to the DB Outbox;
- dead-letter handling MUST preserve enough canonical references to investigate/replay without raw sensitive payloads.

### Object archive
Object storage is for immutable/large fiscal artifacts and evidence, not live transaction truth.

Examples:
- signed DTE XML;
- SII response artifact;
- generated PDF/print representation;
- provider evidence where legally/operationally required.

Canonical DB records store provider-neutral asset references, hashes and metadata rather than infrastructure URLs.

### Local journal
The POS device may keep a local SQLite journal for degraded/offline operation.

- local journal is not global canonical truth;
- every local mutation has one stable idempotency key;
- reconnect replays the same mutation identity;
- integrated online card payment MUST NOT be initiated when Palta cannot first durably create its canonical payment intent;
- cash/manual transactions MAY operate in degraded local mode only when the active business/runtime policy permits it;
- UI MUST make unsynced state obvious without alarming the operator.

## 3. Failure behavior

### Database unavailable
Integrated provider payment: BLOCK.
Reason: Palta cannot safely establish canonical payment identity before money moves.

Cash / manual terminal / transfer recording:
- ALLOW_DEGRADED only when local journal is healthy and the business policy permits offline operation;
- otherwise BLOCK.

Never present an unsaved transaction as fully synchronized.

### Payment provider unavailable
Do not stop unrelated payment rails.

- affected provider: unavailable;
- alternatives may remain available: cash, transfer, manual terminal, another configured provider;
- provider-specific failure must not become a global Commerce outage.

### Payment response timeout / unknown
Never ask the user to immediately charge again.

User state:
`결제 상태 확인 중 — 다시 결제하지 마세요.`

System:
- retain the canonical PaymentIntent;
- reconcile with provider;
- allow replacement payment only after the previous attempt is authoritatively declined/cancelled/failed according to canonical Payment policy.

### SII unavailable
Payment and sale state are not rolled back solely because SII is unavailable.

Fiscal behavior is determined by the current Chile Fiscal policy and legal rules:
- if delayed processing is permitted for that situation, keep FiscalRequest pending and retry asynchronously;
- otherwise surface the required blocking/manual procedure.

Core runtime policy MUST receive `fiscalDeferralAllowed` from the Chile Fiscal layer; it MUST NOT hard-code a legal assumption.

### Queue unavailable
If Postgres transaction + Outbox commit succeeded, the user-facing sale may continue.

- dispatcher retries publishing from Outbox;
- queue outage is operational degradation, not loss of transaction truth.

### Object archive unavailable
A payment or sale should not normally fail because long-term object storage is temporarily unavailable.

However a signed XML/SII response MUST first have a temporary durable representation/reference before the archive task is acknowledged. Archive backlog is retried and monitored.

## 4. Isolation and scale

- every transactional table is tenant-scoped by canonical `business_id`;
- idempotency uniqueness includes tenant/business scope where appropriate;
- no global merchant lock;
- folio allocation locks only the issuer RUT + DTE type / relevant CAF range;
- SII slowdown for one issuer MUST NOT block another issuer;
- payment reconciliation and fiscal processing have independent concurrency/backpressure;
- no full-catalog load on checkout;
- no N+1 stock lookup per sale line;
- use indexed/batched reads and reservations;
- partition/shard only after measured need, not pre-emptively.

Recommended first indexes/constraints include:
- CommerceTransaction `(business_id, idempotency_key)` unique;
- PaymentIntent `(merchant_id, idempotency_key)` unique;
- provider payment reference unique within provider connection where applicable;
- Outbox `(status, next_attempt_at)`;
- FiscalRequest `(business_id, issuer_rut, document_type, idempotency_key)` unique;
- FiscalRequest `(issuer_rut, document_type, status)`;
- Folio reservation uniqueness by issuer/document/folio and fiscal request;
- POS session by business/register/status.

## 5. Latency and user experience

Checkout should wait only for operations required for safe acceptance of the user's action.

Do not keep the cashier waiting for unrelated asynchronous work.

Typical user sequence:

```text
Payment confirmed
Sale recorded
Boleta: processing
Boleta: issued
```

If the provider result is unknown, show a dedicated non-retry state rather than a generic error.

The UI must distinguish:
- `saved locally`;
- `saved to Palta`;
- `payment confirmed`;
- `fiscal pending`;
- `fiscal issued`.

Do not expose infrastructure jargon to a normal merchant.

## 6. Observability

Production telemetry must support at least:

### API / DB
- request p50 / p95 / p99 latency;
- error rate;
- DB transaction/lock/conflict errors;
- connection-pool pressure.

### Commerce / Payment
- checkout completion rate;
- payment provider latency/error by provider;
- count and oldest age of `unknown` payments;
- reconciliation backlog and oldest age;
- idempotency duplicate-block hits;
- refund failures;
- cash-close discrepancy.

### Outbox / Queue
- pending count and oldest pending age;
- publish failures;
- consumer retry count;
- DLQ count/age;
- processing latency by event type.

### Fiscal
- pending FiscalRequest count/age;
- SII transport/status latency;
- accepted / observed / rejected rate;
- remaining CAF/folio capacity;
- signing failures;
- archive failures/backlog.

### Client
- unsynced local POS mutations;
- oldest local unsynced mutation;
- reconnect recovery success/failure.

Logs/metrics MUST NOT contain raw card data, secrets, full DTE XML or unnecessary personal data. Prefer canonical IDs, business IDs, state codes and hashes.

## 7. Environments and rollout

At minimum:
- local;
- development;
- staging/sandbox;
- production.

Provider credentials, merchant IDs, SII certificates, CAF and webhook secrets MUST be environment-separated.

Use merchant/capability flags for progressive rollout, for example:
- `payment.mercadopago`;
- `payment.transbank`;
- `fiscal.sii_direct`;
- enabled DTE types;
- offline/manual mode.

New payment/fiscal capability rolls out to selected pilot merchants before general enablement.

Database migrations must be backward-compatible across rolling deployment where practical.

## 8. Security and audit

- clients are untrusted;
- provider callbacks are untrusted until signature/freshness/replay checks pass;
- no service/admin/payment/SII secrets in mobile/public environment values;
- refunds, fiscal correction documents, permission changes, settlement actions and privileged exports are audited;
- raw PAN/CVV is never stored;
- DTE archive access follows business role/delegation policy;
- accountant access is explicit, scoped and revocable.

## 9. Backup / restore gate

Before real-money production:
- automated DB backups are enabled;
- off-site/export strategy is documented;
- a restore is actually tested;
- object archive recovery/integrity procedure exists;
- secret/certificate rotation procedure exists;
- incident runbook has DB / PSP / SII / queue / object-storage cases.

Development may use free infrastructure. A real-money public POS must not depend on an auto-pausing/no-automatic-backup database configuration.

## 10. Current provider choices are replaceable

Initial operational candidates:
- Database/Auth: Supabase Postgres/Auth;
- DB fallback candidate: Neon Postgres;
- Edge/API: Cloudflare Workers;
- Async transport: Cloudflare Queues;
- Object archive: Cloudflare R2;
- payment adapters: Mercado Pago Point, Transbank POS Integrado;
- fiscal external authority: SII Chile.

These are implementation choices, not canonical Palta identities.

## 11. Cost gates

Development/pilot should remain free-first where it does not compromise transaction correctness.

Current planning assumptions must be re-verified before purchase/deployment:
- Supabase Free is suitable for development but lacks automatic backups and can pause after inactivity;
- production begins with a paid database tier only when real-money/public reliability requires it;
- Cloudflare Queues Free can support development/light pilot transport, while DB Outbox remains durable truth;
- PITR/read replicas/multi-provider failover are activated only when measured transaction value and recovery objectives justify the cost.

No paid provider is activated merely because architecture supports it.

## 12. Production gates

A POS/payment/fiscal release is NOT production-ready until all are true:

- [ ] DB schema/constraints verified
- [ ] RLS/authorization verified
- [ ] transaction + outbox atomicity tested
- [ ] idempotency replay tested
- [ ] payment unknown/reconciliation tested
- [ ] PSP sandbox/terminal test passed
- [ ] webhook verification/replay test passed where applicable
- [ ] offline/degraded behavior tested
- [ ] SII sandbox/certification path passed for enabled DTE
- [ ] folio concurrency test passed
- [ ] SII outage test passed
- [ ] queue outage/replay test passed
- [ ] archive outage/recovery test passed
- [ ] backup restore drill passed
- [ ] latency/load acceptance test passed
- [ ] operational alerts configured
- [ ] secrets/certificate rotation procedure verified
- [ ] owner/cashier/accountant permissions verified
- [ ] cost guard thresholds configured
