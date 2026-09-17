# Palta Payment Reliability Benchmark — 2026-09-17

Status: implementation research / architecture input
Scope: in-person POS payment reliability, recovery, user-visible failure behavior, and scale.

This document compares current provider patterns and translates them into Palta rules. It does not make any provider a constitutional dependency.

## 1. Benchmark sources reviewed

### Mercado Pago Point / Orders API
- Create Point order: https://www.mercadopago.cl/developers/es/reference/in-person-payments/point/orders/create-order/post
- Order/transaction states: https://www.mercadopago.cl/developers/en/docs/mp-point/resources/status-order-transaction
- Cancel order: https://www.mercadopago.cl/developers/en/reference/in-person-payments/point/orders/cancel-order/post
- Orders migration/idempotency: https://www.mercadopago.cl/developers/es/docs/mp-point/migrate-payment-intent-to-orders
- Point webhooks: https://www.mercadopago.cl/developers/en/docs/mp-point/notifications

### Transbank POS Integrado / Autoservicio
- Current integration manual (Autoservicio): https://www.transbankdevelopers.cl/files/manual-integracion-pos-autoservicio-4.9.pdf
- IM integration manual: https://www.transbankdevelopers.cl/files/ManualIntegracion-IM30-v5.pdf
- POS test surface: https://pos-serial.transbankdevelopers.cl/

### SumUp
- Cloud API: https://developer.sumup.com/terminal-payments/cloud-api
- Reader API / idempotent client_transaction_id: https://developer.sumup.com/api/readers
- Quickstart / transaction references: https://developer.sumup.com/terminal-payments/quickstart

### Square
- Terminal checkout: https://developer.squareup.com/reference/square/terminal-api/create-terminal-checkout
- Cancel by idempotency key for unknown CreatePayment: https://developer.squareup.com/reference/square/payments-api/CancelPaymentByIdempotencyKey
- Terminal timeout/cancel behavior: https://developer.squareup.com/docs/terminal-api/square-terminal-payments

### Stripe Terminal / Adyen
- Stripe offline card payments: https://docs.stripe.com/terminal/features/operate-offline/collect-card-payments
- Adyen offline payment risk/reconciliation: https://docs.adyen.com/point-of-sale/offline-payment/
- Adyen Terminal integration checklist: https://docs.adyen.com/point-of-sale/get-started/tapi-checklist

### Chile POS product benchmark
- Bsale plans/payment integration: https://www.bsale.cl/sheet/precios
- Bsale + BCI Pagos: https://www.bsale.cl/sheet/integracion-bcipagos

## 2. What mature payment integrations consistently do

The common pattern is not `charge -> success/error`.

It is:

```text
canonical payment identity
        ↓
provider request identity
        ↓
terminal/provider processing
        ↓
known success / known failure / uncertain outcome / human action
        ↓
reconciliation
        ↓
settlement / refund / audit
```

The dangerous state is not a normal decline. The dangerous state is **uncertainty after money may already have moved**.

## 3. Provider lessons

### Mercado Pago Point

Current Point Orders API requires `X-Idempotency-Key` for creation and other mutating order operations. Reusing the same operation identity is the provider-supported duplicate-protection mechanism.

Important operational states:
- `created`: accepted by API, not yet captured by terminal;
- `at_terminal`: terminal has the order;
- `processed`: payment credited;
- `failed`: definite failure;
- `expired`: order expired;
- `canceled`: canceled;
- `action_required`: terminal/final-state confirmation is required.

Important detail: Mercado Pago documents `action_required` as a state that requires checking the terminal and updating the integrator's system; it does not simply become another status automatically. Palta therefore must not treat this as a normal polling state or allow a replacement charge.

Provider errors worth handling separately:
- `already_queued_order_for_terminal`: a terminal already has an order waiting;
- `idempotency_key_already_used`: same key was reused with a different operation/body;
- ownership/credential errors: merchant/terminal configuration issue;
- 5xx: retry the same operation identity, not a new payment identity.

Webhook behavior:
- authenticate webhook origin with provider secret signature;
- acknowledge delivery quickly;
- deduplicate repeated notifications;
- then fetch/reconcile canonical provider state rather than trusting an unverified callback as final truth.

### Transbank POS Integrado

The strongest operational lesson is response-loss recovery.

The current manuals explicitly describe `Datos Última Venta` for this case:
- the caja sends a sale;
- it does not receive the final sale response;
- the caja asks the POS for the last sale;
- it compares the returned ticket/boleta number with the ticket assigned to the attempted payment;
- if they match, the charge already happened;
- if they differ, only then should a new sale be attempted.

Therefore Palta must retain its own canonical ticket/payment ID before starting the terminal sale.

Another important Transbank behavior is terminal-side reversal protection when authorization-response handling fails. Palta must represent `reversed` separately from a normal `declined` payment.

Critical caveat: Transbank manuals state that a POS close clears stored terminal transaction memory used by last-sale lookup. Therefore **Palta should not allow a clean session/POS close while unresolved Transbank response-loss payments remain**. It should require reconciliation or an explicit audited exception.

### SumUp

SumUp Cloud API is asynchronous: acceptance of the checkout request does not mean successful payment. Final state is received later through the configured callback/webhook.

Useful patterns:
- `client_transaction_id` is a caller-controlled correlation/idempotency identity in current reader flows;
- retrying the same identity returns the original result instead of creating a duplicate in supported flows;
- a reader can reject a second checkout while already occupied;
- failure reason text can evolve, so integrations should not couple canonical logic to free-form provider messages.

Palta implication: store provider code/state when documented, but never make free-form error strings canonical business logic.

### Square

Square reinforces two rules:
- terminal checkout creation uses an idempotency key;
- if a CreatePayment result is unknown due to a network error, Square provides an idempotency-key-based cancel/recovery procedure before a replacement attempt.

Square also documents a timeout race where a terminal checkout may temporarily appear canceled while the device is completing the payment, then later become completed. Webhook/state updates are therefore necessary to avoid treating one transient state observation as final.

Palta implication: provider states are observations. Canonical finalization must respect provider-specific finality semantics.

### Stripe / Adyen offline card processing

Both platforms make the risk explicit: an offline card payment can be accepted locally but later declined when connectivity returns. The merchant can lose the goods/service value.

Adyen recommends transaction floor limits and reconciliation for offline transactions. Stripe similarly warns about issuer decline and tamper risk.

Palta v1 decision:
- do **not** enable true offline integrated-card authorization by default;
- prefer normal online terminal, terminal mobile data/SIM, another payment provider, transfer, cash, or manual external-terminal recording;
- if offline card acceptance is ever added, it requires explicit merchant opt-in, provider support, per-transaction/aggregate exposure limits, visible risk state, reconciliation, and separate accounting treatment.

## 4. Palta canonical incident taxonomy

Provider-specific codes map to a small stable set:

- `definitive_decline`
- `outcome_unknown`
- `provider_unavailable`
- `transient_provider_error`
- `rate_limited`
- `terminal_busy`
- `terminal_action_required`
- `configuration_error`
- `validation_error`
- `idempotency_conflict`
- `cancel_conflict`
- `refund_unknown`
- `provider_error`

Each incident determines:
- whether a replacement payment is allowed;
- whether automatic retry is allowed;
- whether reconciliation is mandatory;
- whether cashier/terminal action is required;
- which user-facing state is shown.

### Non-negotiable safety rule

```text
UNKNOWN / PROCESSING / REQUIRES_ACTION
                ↓
       no replacement charge
                ↓
 reconciliation / terminal confirmation
                ↓
 only after authoritative failed/cancelled/declined
                ↓
       new payment may be offered
```

## 5. POST vs GET failure rule

A network failure during a mutating request (`create payment`, `refund`, `cancel`) can occur after the provider accepted the request but before Palta received the response.

Therefore:
- POST/side-effect transport failure -> `outcome_unknown` (or `refund_unknown`);
- never blind retry as a new payment;
- use provider-supported reconciliation or replay the **same operation identity/idempotency key** when documented safe.

A status GET has no money-moving side effect:
- transport failure -> safe backoff and repeat the same status lookup.

## 6. PaymentPort reconciliation requirement

`getStatus(providerReference)` is insufficient because response loss can happen before Palta learns the provider reference.

The provider-neutral PaymentPort therefore needs:

```text
reconcilePayment({
  canonicalPaymentId,
  idempotencyKey,
  amount,
  terminalId,
  providerReference?  // may be absent
})
```

Provider implementations:
- Mercado Pago: provider reference -> GET order; missing reference after response loss -> safely recover by replaying the exact original Order request with the same idempotency key/provider-supported identity.
- Transbank serial/SDK: use provider-supported last-sale/ticket comparison before any second sale.
- future provider: use its documented reconciliation primitive.

## 7. Terminal-busy behavior

Never show `payment failed` when the terminal is actually occupied.

User experience:

```text
이 단말기에서 이전 결제가 아직 진행 중입니다.
이전 결제를 먼저 확인해 주세요.

[결제 상태 확인]
[다른 결제수단]
```

No automatic second order is created on the same terminal.

## 8. Human-action state

For provider states that require terminal/operator verification:

```text
단말기에서 결제 결과를 확인해 주세요.
새 결제를 시작하지 마세요.
```

This is not a generic failure and not a spinner that polls forever.

## 9. Webhook receiver pattern

A production webhook endpoint must:
1. receive raw headers/body/query needed for signature verification;
2. verify provider signature/timestamp according to provider rules;
3. reject invalid/replayed callbacks;
4. deduplicate provider event ID where available;
5. persist a minimal safe event/reference;
6. acknowledge quickly;
7. enqueue canonical reconciliation;
8. fetch provider canonical state;
9. apply idempotent PaymentEvent transition;
10. never store PAN/CVV or unnecessary raw personal/provider payloads.

Webhook receipt is a trigger to reconcile; it is not automatically trusted canonical truth.

## 10. POS close guard

Before closing a POS/Register session Palta checks:
- unresolved `unknown` payments;
- terminal-action-required payments;
- pending refund outcomes;
- unpersisted local mutations.

Default behavior:
- normal close is blocked while a money-moving operation is uncertain;
- manager override, if ever supported, requires reason + audit and creates a reconciliation task.

This rule is especially important for terminal systems where close may clear recoverable last-transaction state.

## 11. Refunds

Refund/anulación is its own money-moving transaction.

Rules:
- new idempotency identity per refund operation;
- transport timeout -> `refund_unknown`, not `refund_failed`;
- sale/payment history is never rewritten as if the original payment never existed;
- partial refunds retain remaining balance;
- fiscal correction (for example Nota de Crédito when applicable) is a separate Chile Fiscal responsibility, triggered only from confirmed canonical refund/correction state.

## 12. Reconciliation and settlement are different

Real-time payment reconciliation answers:
`Did this customer payment actually succeed?`

Settlement reconciliation answers:
`Did the provider later settle the expected money to the merchant, with the expected fees?`

Palta must eventually support both, but they are not the same state machine.

Future settlement model should support:
- expected gross;
- provider fee;
- expected net;
- settlement date;
- provider settlement reference;
- actual bank/provider settlement;
- difference/exception queue.

Do not block v1 checkout on settlement completion.

## 13. Resilience hierarchy for Chile micro/small merchants

Preferred v1 fallback order:
1. integrated provider online;
2. terminal cellular/SIM or alternate connectivity when terminal/provider supports it;
3. second configured payment provider/terminal;
4. manual external terminal with explicit operator confirmation;
5. bank transfer;
6. cash;
7. true offline card capture only if later explicitly designed and risk-controlled.

This favors keeping the business operating without silently transferring offline-card credit/fraud risk to a small merchant.

## 14. Acceptance scenarios that must pass before production

- client taps Pay twice rapidly;
- API receives same create request twice;
- provider accepts charge but HTTP response is lost;
- terminal already has an order;
- terminal displays final status requiring operator confirmation;
- provider sends webhook twice;
- webhook arrives before API response;
- webhook arrives after cashier navigates away;
- payment provider is down but cash is available;
- DB unavailable before integrated payment starts;
- DB commits payment intent but queue is unavailable;
- provider status lookup times out;
- app restarts during payment;
- device loses Wi-Fi after terminal starts transaction;
- refund response is lost;
- terminal/POS close attempted while an unknown payment exists;
- SII unavailable after payment succeeds;
- two cashiers attempt operations on the same terminal;
- provider response status changes during timeout/cancel race;
- settlement amount differs from expected amount.

No payment integration is production-ready until these scenarios have deterministic behavior and user-facing guidance.
