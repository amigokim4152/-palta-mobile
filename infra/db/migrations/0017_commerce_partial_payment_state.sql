-- Adds an explicit partially_paid commerce state for split/group checkout.
-- Existing migration history remains immutable; this migration only widens the
-- canonical state constraint.

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
