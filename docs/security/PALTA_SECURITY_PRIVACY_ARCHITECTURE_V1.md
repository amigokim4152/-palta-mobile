# Palta Security & Privacy Architecture v1

## Security is a product boundary, not a later hardening pass

Palta protects two classes of assets:

1. **People**
   - identity
   - precise location
   - Personal Home
   - family/group relationships
   - health-related information
   - communications
   - order/payment history

2. **Business**
   - merchant data
   - pricing and catalog history
   - sales/operations analytics
   - transaction history
   - internal rules and fraud signals
   - infrastructure secrets
   - proprietary ranking/decision logic
   - source code and operational tooling

## Zero-trust assumptions

- Client devices are untrusted.
- Public networks are untrusted.
- Provider callbacks are untrusted until verified.
- Staff access is not implicitly trusted.
- Provider identifiers are not Palta identities.
- A valid login does not imply authorization to a resource.

## Personal data boundary

Personal Home must be authorized as `self` scope by default.

Support/operator access must not be ambient.
Any exceptional support access requires:
- explicit elevated grant
- purpose
- time limit
- audit trail

Sensitive fields must not be exposed to general analytics pipelines.

## Business access boundary

Business users receive role capabilities rather than broad admin access.

Examples:
- owner can manage staff, refunds and exports
- cashier can complete orders and read payment status
- kitchen can prepare orders but cannot refund or export
- viewer can see selected analytics but cannot change operations

Discounts/pricing/refunds are intentionally separate capabilities.

## Payment boundary

Palta must minimize payment scope.

Never store:
- PAN/card number
- CVV
- provider private access tokens on mobile
- service-role/admin database credentials on mobile
- webhook signing secrets on mobile

Store only canonical payment state plus provider references needed for reconciliation.

## Webhooks

Payment/provider callbacks require:
- provider signature validation
- timestamp freshness validation
- raw-body verification when provider requires it
- provider event ID deduplication
- replay protection
- idempotent state transitions

Webhook payloads do not directly mutate UI/domain state without verification and canonical mapping.

## Data classification

Classes:
- public
- internal
- confidential
- personal
- sensitive_personal
- payment_restricted

Handling is class-based, not screen-based.

## Location privacy

Use the minimum precision required.

Examples:
- navigation: exact
- nearby discovery: neighborhood
- eligibility: commune
- analytics: city

Do not retain exact location merely because it was available.

## Encryption

Target architecture:
- TLS for network transport
- provider/database encryption at rest
- managed key rotation for server-side secrets
- platform secure storage for user tokens on device
- no secrets in source, bundles or public environment variables

Field-level encryption can be added for selected sensitive fields when the threat model justifies it.

## Auditability

Audit:
- denied privileged actions
- role/permission changes
- refunds
- settlement actions
- exports
- support access
- authentication anomalies
- secret/key administrative changes

Do not put raw sensitive payloads into audit logs.

## Anti-abuse / fraud

Protect:
- QR session replay
- automated ordering abuse
- account takeover attempts
- refund abuse
- coupon/discount abuse
- scraping
- mass export
- webhook replay
- credential stuffing

Response ladder:
- allow
- challenge
- throttle
- block and review

## Business/IP protection

Do not rely on mobile obfuscation as primary security.

Keep proprietary assets server-side where practical:
- ranking rules
- fraud rules
- pricing/routing logic
- sensitive analytics
- provider credentials
- administrative tools

Protect APIs using:
- authentication
- authorization
- rate limits
- response minimization
- signed/expiring asset access when needed
- monitoring/anomaly detection

Public facts remain public; Palta's normalized datasets, derived signals and internal operational analytics do not need to be exposed wholesale.

## Backups and recovery

Required before production:
- encrypted backups
- tested restore
- point-in-time recovery where supported
- key/secret rotation plan
- incident response runbook
- provider outage fallback
- security contact/escalation path

## Development rule

No feature is production-ready only because its happy path works.

Security acceptance requires:
- authentication
- authorization
- data classification
- abuse controls
- auditability
- failure behavior
- secret boundary
- retention/deletion behavior
