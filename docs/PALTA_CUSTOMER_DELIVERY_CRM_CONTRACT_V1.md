# Palta Customer Delivery & CRM Contract V1

Status: implementation contract  
Reviewed: 2026-09-17

## 1. Decision

A printed receipt is only one delivery option.

After a sale/order/service, Palta must be able to deliver the relevant artifact or status to the customer through the most convenient available channel without coupling Commerce Core to WhatsApp, email, SMS or a single notification provider.

`Commerce/Fiscal/Order`
→ `Customer Artifact`
→ `secure short-lived share link when needed`
→ `Customer Delivery`
→ `channel adapter`
→ `relationship touchpoint`

## 2. Initial channels

- Palta inbox / app
- WhatsApp handoff
- OS/system share sheet
- SMS
- email
- QR shown on merchant/customer screen
- WhatsApp Business automation later, only when operationally justified

A merchant should be able to tap `Send receipt`, choose or confirm the customer/contact, and hand off immediately.

## 3. Low-cost first path

Initial WhatsApp behavior should be user-initiated handoff rather than requiring a paid automation platform for every merchant.

The client prepares a short message and short-lived Palta share URL, then opens the customer's WhatsApp conversation or the native share sheet. The merchant confirms/sends in WhatsApp.

This state is recorded as `handed_off`, not `delivered`, because Palta does not have authoritative delivery evidence from a user-initiated handoff.

When later using the WhatsApp Business Platform or another provider with delivery receipts, the adapter may advance the delivery through queued/sent/delivered based on provider evidence.

## 4. Customer artifact types

Initial:
- receipt
- Boleta/Factura access
- order status
- pickup code
- quote summary
- service summary

Do not copy full Fiscal XML, private object-storage URLs or sensitive data into message logs.

For fiscal/receipt documents, send a Palta share resolver URL with a time-bounded token. The token is stored hashed and may be revoked/limited. Object storage remains private.

## 5. Relationship and CRM

If a known customer receives a transaction/service artifact, Palta records a relationship touchpoint:

- customer
- business
- source transaction/order/service
- artifact kind
- delivery channel
- delivery event/time

This helps the business see a legitimate service history, such as:

`2026-09-17 · purchase completed · receipt shared by WhatsApp`

The touchpoint is history only. It never creates marketing permission.

## 6. Permission separation

These remain separate:

`Transaction/Service History ≠ Service Follow-up Permission ≠ Marketing Permission`

### Transactional
Examples:
- receipt
- Boleta/Factura access
- order ready
- pickup code
- payment/fiscal status relevant to the completed transaction

A customer may request a one-off transactional delivery without being subscribed to marketing.

### Service follow-up
Examples:
- next garden visit reminder
- warranty/service check-in
- requested recurring care

Requires the applicable service-follow-up permission/policy.

### Marketing
Examples:
- promotions
- coupons
- campaigns
- new product announcements

Requires separate marketing permission. A phone number obtained for a receipt is not automatically a marketing list entry.

## 7. Contact handling

The customer may be:
- existing Palta customer/contact
- Palta user
- guest providing a phone/email for the current transaction
- selected from the device contact/share interface

Where possible, client-side system contact/share UI is preferred over copying the user's whole address book into Palta.

Canonical CRM should store only the contact data the business legitimately needs for the relationship and its declared purpose.

## 8. Merchant UX

After payment/fiscal processing:

`Receipt / Boleta`

- View
- Print
- Send

`Send` opens the smallest relevant chooser, e.g.:

- Palta
- WhatsApp
- Share…
- SMS
- Email

If a known customer has a preferred/available transactional route, highlight it but allow the operator to choose another permitted route.

Do not force customer creation just to share a one-time receipt.

## 9. Customer UX

A share URL should open a lightweight web surface without requiring the Palta app.

The page may offer:
- view receipt/document
- download where appropriate
- order/service status
- open in Palta if installed
- optionally identify/claim the history into a Palta account

Claiming history must use explicit identity matching/authorization; receiving a link alone must not grant access to other customer history.

## 10. Reliability semantics

Delivery status is explicit:
- prepared
- handed_off
- queued
- sent
- delivered
- unknown
- failed

Do not retry an `unknown` provider operation by creating a different message identity unless the provider/channel rules prove that it is safe.

For user-controlled share handoffs, `handed_off` is the honest terminal state unless later provider evidence exists.

## 11. Privacy-safe support

Operational diagnostics may include:
- delivery ID
- business/customer opaque IDs
- channel
- artifact kind
- adapter version
- status/error code
- timestamps

Do not put message body, fiscal document contents, customer phone/email or secure-token plaintext into general diagnostic logs.

## 12. Integration with existing Notification Core

Palta Inbox / push continues to use the existing Notification Core and notification adapters.

Customer Delivery is a Commerce-facing orchestration layer that may choose Palta Inbox as one route. It does not replace Home notification policy and it does not turn WhatsApp/SMS/email into Palta push-notification concepts.

## 13. Principle

**One transaction artifact, many delivery routes, one customer relationship history — without turning a receipt into marketing consent.**
