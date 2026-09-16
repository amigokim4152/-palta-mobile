# Palta Security Gates v1

## Gate A — Before code merge
- no secrets committed
- no service credentials in mobile
- canonical authorization decision defined
- data class identified
- provider-specific secret types isolated in adapters/server

## Gate B — Before staging
- deny-by-default authorization tests
- tenant/business isolation tests
- webhook signature and replay tests
- idempotency tests
- rate limit / abuse tests
- logging redaction review

## Gate C — Before payment pilot
- payment provider sandbox verified
- refund/duplicate webhook scenarios verified
- no PAN/CVV storage
- merchant role permissions verified
- support access audited
- reconciliation test completed

## Gate D — Before public launch
- external dependency inventory
- backup/restore drill
- incident response runbook
- key rotation process
- privacy/retention review
- account recovery flow
- basic penetration test / security review
- mobile secure-storage review

## Gate E — Before direct regulated financial activity
- Chilean legal/regulatory review
- licensing/registration requirements confirmed
- AML/KYC obligations confirmed
- capital/reserve/settlement obligations confirmed
- independent security/compliance review
