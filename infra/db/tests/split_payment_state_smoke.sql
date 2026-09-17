\set ON_ERROR_STOP on

-- Verifies migration 0017 widened only the canonical commerce lifecycle and that
-- Postgres accepts the explicit partially_paid state used by split/group checkout.

insert into public.canonical_entity (
  id, entity_type, canonical_key, display_name, status
) values (
  '71717171-7171-4171-8171-717171717171',
  'business',
  'ci-split-payment-business',
  'CI Split Payment Business',
  'active'
);

insert into public.business (entity_id, verification_status) values (
  '71717171-7171-4171-8171-717171717171',
  'verified'
);

insert into public.commerce_transaction (
  id,
  business_id,
  idempotency_key,
  state,
  total_amount_minor,
  lines
) values (
  '72727272-7272-4272-8272-727272727272',
  '71717171-7171-4171-8171-717171717171',
  'ci-split-payment-transaction',
  'partially_paid',
  10000,
  '[]'::jsonb
);

do $$
declare
  observed_state text;
  invalid_blocked boolean := false;
begin
  select state into observed_state
    from public.commerce_transaction
   where id = '72727272-7272-4272-8272-727272727272';

  if observed_state <> 'partially_paid' then
    raise exception 'partially_paid commerce state did not persist';
  end if;

  begin
    update public.commerce_transaction
       set state = 'payment_maybe'
     where id = '72727272-7272-4272-8272-727272727272';
  exception when check_violation then
    invalid_blocked := true;
  end;

  if not invalid_blocked then
    raise exception 'commerce state constraint accepted an unknown state';
  end if;
end $$;

select 'PASS: split payment partially_paid commerce state smoke test' as result;
