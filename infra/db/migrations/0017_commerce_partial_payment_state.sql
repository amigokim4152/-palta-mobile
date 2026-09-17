-- Adds an explicit partially_paid commerce state for split/group checkout.
-- Existing migration history remains immutable; this migration only widens the
-- canonical state constraint and adds the transaction-scoped payment lookup used
-- to calculate split-payment coverage safely.

alter table public.commerce_transaction
  drop constraint if exists commerce_transaction_state_check;

alter table public.commerce_transaction
  add constraint commerce_transaction_state_check
  check (state in (
    'draft',
    'ready_for_payment',
    'payment_pending',
    'partially_paid',
    'payment_confirmed',
    'completed',
    'cancelled',
    'refund_pending',
    'refunded'
  ));

comment on constraint commerce_transaction_state_check on public.commerce_transaction is
  'Canonical commerce lifecycle including split/group checkout partially_paid state.';

create index if not exists payment_intent_business_transaction_idx
  on public.payment_intent(business_id, commerce_transaction_id, created_at, id);
