-- PALTA PAYMENT CARD EVIDENCE
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Persists provider/terminal-confirmed card funding and installment evidence.
-- These columns are evidence only: they do not change the requested amount and
-- they must never be populated from an unverified cashier guess as accounting truth.

alter table public.payment_intent
  add column if not exists card_funding_type text;

alter table public.payment_intent
  add column if not exists installment_count integer;

alter table public.payment_intent
  add column if not exists installment_amount_minor bigint;

alter table public.payment_intent
  drop constraint if exists payment_intent_card_funding_type_check;

alter table public.payment_intent
  add constraint payment_intent_card_funding_type_check
  check (
    card_funding_type is null or
    card_funding_type in ('debit', 'credit', 'prepaid', 'unknown')
  );

alter table public.payment_intent
  drop constraint if exists payment_intent_installment_count_check;

alter table public.payment_intent
  add constraint payment_intent_installment_count_check
  check (installment_count is null or installment_count > 0);

alter table public.payment_intent
  drop constraint if exists payment_intent_installment_amount_check;

alter table public.payment_intent
  add constraint payment_intent_installment_amount_check
  check (installment_amount_minor is null or installment_amount_minor > 0);

alter table public.payment_intent
  drop constraint if exists payment_intent_installment_amount_requires_count_check;

alter table public.payment_intent
  add constraint payment_intent_installment_amount_requires_count_check
  check (installment_amount_minor is null or installment_count is not null);

-- No index is added: these are per-payment evidence fields, not expected primary
-- checkout lookup keys. Add an analytics index only after measured query demand.
