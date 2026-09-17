\set ON_ERROR_STOP on

-- Verifies migration 0018 keeps the requested amount immutable while persisting
-- provider-confirmed processed amount evidence for partial approvals.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_intent'
      and column_name = 'processed_amount_minor'
  ) then
    raise exception 'payment_intent.processed_amount_minor is missing';
  end if;
end $$;

update public.payment_intent
   set processed_amount_minor = 6000
 where id = '99999999-9999-4999-8999-999999999999';

do $$
declare
  requested bigint;
  processed bigint;
  blocked boolean := false;
begin
  select amount_minor, processed_amount_minor
    into requested, processed
    from public.payment_intent
   where id = '99999999-9999-4999-8999-999999999999';

  if requested <> 12000 or processed <> 6000 then
    raise exception 'processed amount persistence changed requested=% or processed=%', requested, processed;
  end if;

  begin
    update public.payment_intent
       set processed_amount_minor = 0
     where id = '99999999-9999-4999-8999-999999999999';
  exception when check_violation then
    blocked := true;
  end;

  if not blocked then
    raise exception 'zero processed payment amount was not rejected';
  end if;
end $$;

select 'PASS: processed payment amount remains separate from requested amount' as result;
