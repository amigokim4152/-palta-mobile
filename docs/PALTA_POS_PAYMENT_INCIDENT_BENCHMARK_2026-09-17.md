# Palta POS / Payment Incident Benchmark — 2026-09-17

Status: active engineering benchmark  
Scope: Commerce Core, Payment, POS, Printing, Fiscal handoff, Customer Receipt Delivery

## 1. Purpose

Palta must be designed against real failure modes seen in mature POS/payment systems, not only the happy path.

This benchmark turns public incident history and official integration guidance into concrete Palta invariants. It should be revisited when payment providers, POS runtimes, Device Bridge, fiscal providers, or customer-delivery channels change.

## 2. Sources reviewed

Primary/official sources reviewed for this revision include:

- Clover — duplicate payments: https://docs.clover.com/dev/docs/checking-for-duplicate-payments
- Clover — payment issues including partial/offline/duplicate: https://docs.clover.com/dev/docs/manual-entry-payments
- Adyen — API idempotency: https://docs.adyen.com/development-resources/api-idempotency
- Mercado Pago Chile — Point Orders create API and `X-Idempotency-Key`: https://www.mercadopago.cl/developers/en/reference/in-person-payments/point/orders/create-order/post
- Mercado Pago Chile — migration to Orders/idempotency: https://www.mercadopago.cl/developers/en/docs/mp-point/migrate-payment-intent-to-orders
- Stripe — idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Stripe Terminal — offline card collection: https://docs.stripe.com/terminal/features/operate-offline/collect-card-payments
- Square status — Aug 2026 Register/POS/Payment Acceptance disruption: https://www.issquareup.com/united-states/incidents/01KZ78X7PXX2328TSJVE2A3BT0
- Square status — Feb 2026 multiple-services disruption: https://www.issquareup.com/united-states/incidents/01KGN4HQVK2J6AV7NT6DBZ1VQV
- Toast status / post-AWS outage recovery guidance: https://status.toasttab.com/
- WhatsApp Business policy: https://whatsappbusiness.com/policy/

Provider docs and status pages are evidence of failure classes and provider contracts, not proof that Palta should reproduce a vendor-specific implementation.

## 3. Failure matrix

| Failure class | Industry evidence | Palta control | Current status |
| --- | --- | --- | --- |
| Duplicate charge after retry | Clover duplicate issue; Stripe/Adyen/Mercado Pago idempotency | Durable PaymentIntent before provider call; stable idempotency key; replacement payment blocked while result is unresolved | COVERED |
| Request succeeded but response was lost | Terminal/network timeout patterns; Mercado Pago safe same-key replay; Transbank last-sale recovery requirement | `unknown` state; reconcile original operation; no blind replacement charge | COVERED |
| Same payment callback delivered more than once | Payment webhook systems are at-least-once in practice | Durable provider-notification inbox; provider event identity; signature verification; callback is signal, not truth | COVERED |
| Webhooks arrive out of order | Provider webhook guidance | Fetch authoritative provider status and apply canonical state transition/CAS; stale transitions cannot regress paid state | COVERED |
| Partial authorization/partial payment | Clover explicitly requires checking resulting payment amount | Preserve requested `amount` and provider-confirmed `processedAmount` separately; payment coverage uses processed amount only for authoritative paid value | COVERED — added 2026-09-17 |
| Concurrent split/group payers exceed order total | Multi-payer QR/POS race | Sum paid + unresolved requested exposure; reserve unresolved amount; block new allocation above remaining exposure budget | COVERED |
| Terminal already busy with prior order | Mercado Pago `already_queued_order_for_terminal` | Normalize to `terminal_busy`; operator resolves previous transaction instead of retrying a new payment | COVERED |
| Refund response lost | Provider/network failure | `refund_unknown`; reconciliation before retry; same operation identity | COVERED |
| Provider/acquirer/network outage | Square/payment-partner incidents; broad POS outages | Provider-neutral adapter; canonical DB state; alternate payment method; queue/reconciliation; provider failure must not corrupt Commerce | PARTIAL |
| Entire cloud/POS service outage | Square multi-service disruption; Toast/AWS recovery guidance | Durable local/manual sale journal where policy permits; independent Payment/Fiscal/Print state; restart recovery | PARTIAL |
| Offline card accepted but later declined | Stripe/Clover offline risk guidance | Generic offline integrated card mode remains disabled until provider-specific risk budget exists | SAFE BY DEFAULT / NOT IMPLEMENTED |
| POS/device software regression | Square Aug 2026 Register issue requiring app update | Adapter/bridge version checks exist; staged POS app rollout, kill switch and rollback contract still required | GAP |
| Reporting/dashboard delayed while payment works | Common provider status separation | Canonical Commerce/Payment DB is source of truth; reporting must be read model only | COVERED BY ARCHITECTURE |
| Printer command succeeded but acknowledgement lost | Physical printer/network/bridge reality | `outcome_unknown`; never auto-reprint; reconcile; only definitive `failed_before_output` may retry | COVERED |
| Printer firmware/platform regression | Peripheral ecosystem fragmentation | Exact platform/firmware/transport certification; signed adapter/bridge code; data-only compatibility manifest | COVERED |
| Print failure rolls back sale/payment/fiscal | POS coupling failure | Printing is projection only; never owns Sale/Payment/Fiscal state | COVERED |
| SII/fiscal provider outage after payment | Chile fiscal external dependency | Payment state is independent; fiscal durable queue/reconciliation/deferral policy | COVERED / PROVIDER-SPECIFIC RULES REQUIRED |
| Receipt requires cashier to type customer phone/email | Common digital receipt friction | Palta Inbox when known; otherwise short-lived Palta receipt QR; contact entry only explicit fallback | COVERED BY POLICY — UI/server binding pending |
| WhatsApp outbound requires destination/permission | WhatsApp Business policy | Do not make outbound WhatsApp the default guest path; customer may scan Palta QR or initiate WhatsApp chat from own phone | COVERED BY POLICY — inbound worker pending |

## 4. Frozen payment invariants

1. A timeout is not a decline.
2. `processing`, `requires_action` and `unknown` block a replacement charge until resolved.
3. Retrying an operation reuses the same operation/idempotency identity.
4. A new payment intent is a new intentional payment, never a network retry.
5. Provider callbacks wake Palta up; they do not become canonical truth without provider/state validation.
6. Payment provider result, Commerce state, fiscal state and print state are separate durable states.
7. A `paid` provider status does not imply the full requested amount was paid. Use provider-confirmed processed amount when supplied.
8. Unresolved split-payment exposure reserves the full requested amount until reconciliation proves it unpaid.
9. Overpayment or potential overexposure stops normal projection and requires operator review.
10. Refund uncertainty receives the same conservative treatment as payment uncertainty.

## 5. Offline payment policy

Palta does not enable generic offline integrated-card acceptance merely because a terminal SDK can do it.

Before any provider gets an offline-card capability, its adapter/profile must define:

- exact supported terminal/platform versions;
- maximum single offline transaction amount;
- maximum aggregate offline amount per terminal/register/business;
- maximum offline duration and provider upload deadline;
- card/network restrictions if the provider imposes them;
- tamper/root/jailbreak/device-integrity requirements;
- customer/operator indication that authorization is deferred;
- durable local queue and encryption requirements;
- reconnect upload order and idempotency identity;
- post-upload decline handling;
- session close rules while unresolved offline money exists;
- operational kill switch.

Until all fields are known and tested, `offlineIntegratedCard = disabled` is the required default.

## 6. Release-regression policy

A POS can fail because of the Palta client/bridge version even when servers and payment networks are healthy. Production release architecture therefore needs:

- staged/canary rollout by app/bridge version;
- health/error comparison by version;
- remote feature kill switches for risky integrations;
- ability to stop rollout quickly;
- supported rollback path where platform permits;
- minimum/maximum compatible adapter/bridge protocol versions;
- payment creation gate when a known-bad client version is detected;
- no forced upgrade in the middle of an unresolved payment or print operation.

This is an open implementation item.

## 7. Receipt delivery policy

### Preferred order

1. **Known Palta user** → save receipt/fiscal artifact to Palta Inbox automatically.
2. **Guest/unknown customer** → show a large short-lived Palta receipt QR on POS/customer display.
3. Customer opens the receipt on their own phone and may save it to Palta or use system share/WhatsApp from their device.
4. If a transactional phone/email destination is already known for this transaction, offer it without retyping.
5. Manual phone/email entry is an explicit fallback, never a checkout requirement.
6. Paper is optional; printer failure does not block completed commerce/payment/fiscal state.

### Customer-initiated WhatsApp option

To avoid asking the cashier for the customer's number:

- POS can show a second QR that opens `wa.me/<PALTA_OR_MERCHANT_BUSINESS_NUMBER>?text=<ONE_TIME_RECEIPT_REQUEST>`.
- The customer scans it on their own phone and initiates the conversation.
- The inbound WhatsApp worker correlates the short-lived one-time request and replies with the normal Palta secure receipt link.
- The claim/request token is one-time, short-lived and stored hashed; it is not a customer identifier and grants no marketing permission.
- WhatsApp contact learned from this transactional interaction must not silently become CRM marketing consent.

Phase 1 should ship the direct Palta HTTPS receipt QR first because it has fewer external dependencies. WhatsApp customer-initiated handoff is additive.

## 8. Open engineering gaps, ordered

### P0 — before real-money broad rollout

1. Finish Payment → Commerce coverage projector with CAS and one durable `commerce.payment_confirmed` transition event.
2. Normalize provider payment issues/risk signals separately from payment status (potential duplicate, partial-payment warning, offline-risk flag, signature/operator challenge where relevant).
3. Add production client/bridge release health gate, staged rollout and kill-switch contract.
4. Add provider health/circuit-breaker state so an upstream outage produces a clear alternate-payment flow instead of repeated terminal attempts.
5. End-to-end chaos tests: provider timeout after charge, duplicate webhook, out-of-order webhook, process crash between DB commit and external call, process crash after external call before response persistence.

### P1 — receipt/customer experience

6. Bind `ReceiptDeliveryPlan` to the actual checkout-complete UI.
7. Render short-lived `customer_share_link` as large QR on POS/customer display.
8. Add “Guardar en Palta” claim/login handoff on receipt web page.
9. Add customer-side system share/WhatsApp from the receipt page.
10. Implement inbound WhatsApp receipt-request worker only after a business WhatsApp number, webhook verification and one-time claim persistence are ready.

### P1 — offline/operations

11. Keep integrated-card offline disabled until the selected Chile provider exposes sufficient recovery/risk controls.
12. Add per-provider incident runbooks and operator messages.
13. Persist provider/service health observations separately from canonical payment truth.
14. Add reconciliation dashboards for unresolved money, fiscal and print outcomes.

## 9. Review rule

Every new payment provider, POS device class, fiscal provider, printer adapter or receipt channel must be checked against this matrix before it can be marked production-ready.

A feature is not production-ready merely because its happy-path API call succeeds.
