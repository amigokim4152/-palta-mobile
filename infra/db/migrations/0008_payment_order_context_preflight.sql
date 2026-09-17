-- PALTA PAYMENT ORDER CONTEXT PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- A PaymentIntent always belongs to CommerceTransaction. Order is optional
-- context only, but when present it must survive persistence/reload.

alter table public.payment_intent
  add column if not exists order_id uuid;

create index if not exists payment_intent_order_idx
  on public.payment_intent(business_id, order_id)
  where order_id is not null;
