# Palta Payment & Commerce Architecture v1

## Principle

Palta may use an external payment provider first, but Palta must own the canonical commerce experience:

- canonical business identity
- canonical outlet identity
- canonical trading session
- canonical order
- canonical payment intent
- payment state
- pickup state
- merchant relationship
- transaction history
- analytics

Provider identities remain external references.

## Expansion path

### Phase 1 — External payment, Palta transaction ownership
Palta owns order / queue / pickup. PSP processes money.

### Phase 2 — Palta Checkout
Users see one Palta checkout experience.
Payment providers are adapters.

### Phase 3 — Routing and transaction revenue
Multiple PSPs may be selected by:
- supported rail
- merchant preference
- commercial terms
- reliability
- future cost/risk policy

### Phase 4 — Account-to-account / payment initiation
The canonical model already supports `account_to_account`.

### Phase 5 — Direct regulated payment capabilities
Only consider after transaction volume, regulation, risk, capital and economics justify it.

## Core contracts

`PaymentPort`
- createPayment
- getStatus
- refund
- supportsRail

`MerchantPaymentConnection`
- provider connection status
- capability flags
- external merchant reference

`PaymentIntent`
- Palta payment ID
- Palta order ID
- merchant ID
- amount
- payment rail
- provider key/reference
- fee
- settlement status/reference
- idempotency key

`PaymentEvent`
- append-only canonical transaction events

## Provider-independence rule

Forbidden in domain/core:
- Mercado Pago SDK types
- Transbank SDK types
- Getnet SDK types
- provider OAuth token formats
- provider-specific payment statuses as canonical status
- provider merchant IDs as primary Palta identity

Provider-specific code belongs in adapters.

## Commerce expansion

The same order/payment core serves:

- fondas
- ferias
- pop-up sellers
- food trucks
- permanent restaurants
- restaurant waiting/order flows
- reservations requiring deposits
- local businesses
- marketplace transactions
- future ticketing/transport use cases

Do not create a separate payment domain for each vertical.
