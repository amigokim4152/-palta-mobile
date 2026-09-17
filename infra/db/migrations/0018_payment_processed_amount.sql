-- Preserve the amount a payment provider actually processed separately from the
-- amount Palta requested. This prevents partial approvals from being treated as
-- full payment while keeping the original requested exposure immutable.

alter table public.payment_intent
  add column if not exists processed_amount_minor bigint
    check (processed_amount_minor is null or processed_amount_minor > 0);

comment on column public.payment_intent.processed_amount_minor is
  'Provider-confirmed amount actually processed/authorized. Requested amount_minor remains immutable canonical intent.';
