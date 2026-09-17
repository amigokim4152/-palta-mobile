# Palta Commerce Cloudflare Runtime

Status: PRE-DEPLOYMENT TEMPLATE — do not deploy until development Postgres, Hyperdrive IDs, queue names and secret inventory are approved.

This directory is deliberately separate from `infra/cloudflare/` (map/public edge infrastructure).

## Runtime units

1. `api/` — user-facing Palta Commerce API
   - verifies Palta identity and business operational capability
   - creates `BusinessScopedSqlDatabase`
   - commits canonical Commerce/Payment/Fiscal request records first
   - publishes **Outbox IDs only** to payment/fiscal queues as best-effort acceleration after DB commit
   - queue publication failure must never roll back an already-committed canonical transaction

2. `payment-worker/` — payment reconciliation/provider worker
   - sole active consumer of the payment queue
   - claims the exact canonical Outbox ID before any provider side effect
   - uses payment-worker DB principal/RLS policies
   - resolves provider adapters by **business + provider connection + terminal**, never by provider name alone
   - reads merchant credentials through `PaymentSecretStore`; provider tokens never live in source/config or canonical Payment rows
   - handles callbacks, reconciliation, refunds and provider status polling

3. `fiscal-worker/` — Chile SII/DTE worker
   - sole active consumer of the fiscal queue
   - claims the exact canonical Outbox ID before any SII side effect
   - uses fiscal-worker DB principal/RLS policies
   - owns certificate/secret references outside source code
   - stores signed XML/PDF/SII evidence in the fiscal R2 bucket

4. `outbox-dispatcher/` — recovery/sweeper worker
   - scheduled recovery path for lost Queue publications
   - scans due DB Outbox IDs without performing payment/SII side effects
   - republishes IDs to the correct queue
   - duplicates are expected and harmless because consumers must acquire `claimEvent()` lease first

## Source-of-truth rule

```text
Postgres canonical row + durable Outbox
                 |
                 +---- Queue acceleration ----> Worker ----> Provider/SII
                 |
                 +---- Scheduled dispatcher recovery --------^
```

Cloudflare Queue is not the source of truth. Losing, retrying or duplicating a Queue message must not lose or duplicate money/fiscal operations.

## Database connection

Cloudflare Hyperdrive is the intended edge connection layer. Runtime adapters create a `pg.Client` from the Hyperdrive `connectionString`, while domain/persistence code depends only on `SqlDatabase`.

Do not use Supabase Data API CRUD for multi-statement money/fiscal transactions.

## Merchant credential vault

Do **not** create one Cloudflare Worker/Secrets-Store secret per merchant. The merchant count must not become an infrastructure-secret count.

Canonical long-term boundary:

```text
Cloudflare / external secret manager
        └─ small rotating KEK set (for example current + previous)
                         |
                         v
Postgres payment_credential_envelope
        ├─ ciphertext (AES-256-GCM)
        ├─ per-credential random DEK, wrapped by KEK
        ├─ independent data/wrap IVs
        ├─ KEK ID + AAD version
        └─ business/provider/connection identity authenticated as AAD
                         |
                         v
Payment Worker Web Crypto
        └─ plaintext exists only while building the provider request
```

Rules:

- one random data-encryption key (DEK) per credential bundle
- DEK is wrapped under an externally held key-encryption key (KEK)
- persisted DB backups contain ciphertext + wrapped DEK, not the KEK
- business ID, provider key, provider connection ID and credential reference are AES-GCM associated data so row swapping/cross-tenant copying fails authentication
- `credentialRef` is a locator, never authorization by itself
- secret reads require the full business/provider/connection context
- imported KEKs are non-extractable `CryptoKey` objects and should be cached in-process after secure loading
- key rotation advances credential revision and moves new writes to the current KEK; previous KEK remains only for the controlled migration window
- Supabase Vault may be implemented as a `PaymentSecretStore` adapter for development/pilot, but Payment Core must not depend on Supabase Vault semantics
- platform-wide secrets/KEKs may use Cloudflare Secrets Store or another KMS/HSM adapter; merchant tokens must remain behind the provider-neutral vault interface

## Security boundaries

- Browser/mobile never receives direct grants on raw Commerce/Payment/Fiscal/credential tables.
- API requests use business-scoped RLS context.
- Payment/Fiscal workers use separate least-privilege database roles.
- No Worker uses a database role with `BYPASSRLS` for ordinary runtime work.
- Provider/SII credentials are encrypted merchant credentials or external secret references, never ordinary config values.
- Never store PAN/CVV/PIN.
- Raw provider webhook payload is not retained by default; retain minimal identity/hash/audit metadata.

## Queue payload

Queue messages are deliberately tiny:

```json
{ "outboxEventId": "uuid" }
```

Do not put customer, payment-card, tax-document or certificate data in Queue messages.

## Deployment gates

Do not deploy production until all are true:

- development Postgres migrations verified
- RLS/role tests verified against real Postgres
- encrypted merchant credential write/read/rotation/tamper tests verified against the real runtime
- KEK source and rotation runbook verified without committing key material to Git/DB
- Hyperdrive connectivity verified
- Queue duplicate/loss/retry simulation verified
- R2 fiscal archive integrity/hash verification verified
- provider sandbox credentials available
- SII certification prerequisites available for the issuer
- observability/alerts and rollback runbook exist
