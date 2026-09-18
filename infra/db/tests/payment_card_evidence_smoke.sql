\set ON_ERROR_STOP on

-- Verifies migration 0020 persists provider/terminal-confirmed card funding and
-- installment evidence without changing the requested payment amount.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_intent'
      and column_name = 'card_funding_type'
  ) then
    raise exception 'payment_intent.card_funding_type is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_intent'
      and column_name = 'installment_count'
  ) then
    raise exception 'payment_intent.installment_count is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_intent'
      and column_name = 'installment_amount_minor'
  ) then
    raise exception 'payment_intent.installment_amount_minor is missing';
  end if;
end $$;

update public.payment_intent
   set card_funding_type = 'credit',
       installment_count = 3,
       installment_amount_minor = 4000
 where id = '99999999-9999-4999-8999-999999999999';

do $$
declare
  requested bigint;
  funding text;
  installments integer;
  installment_amount bigint;
  blocked boolean := false;
begin
  select amount_minor, card_funding_type, installment_count, installment_amount_minor
    into requested, funding, installments, installment_amount
    from public.payment_intent
   where id = '99999999-9999-4999-8999-999999999999';

  if requested <> 12000 or funding <> 'credit' or installments <> 3 or installment_amount <> 4000 then
    raise exception 'card evidence persistence mismatch requested=% funding=% count=% installment_amount=%',
      requested, funding, installments, installment_amount;
  end if;

  begin
    update public.payment_intent
       set card_funding_type = 'invalid'
     where id = '99999999-9999-4999-8999-999999999999';
  exception when check_violation then
    blocked := true;
  end;

  if not blocked then
    raise exception 'invalid card_funding_type was not rejected';
  end if;

  blocked := false;
  begin
    update public.payment_intent
       set installment_count = null,
           installment_amount_minor = 4000
     where id = '99999999-9999-4999-8999-999999999999';
  exception when check_violation then
    blocked := true;
  end;

  if not blocked then
    raise exception 'installment amount without count was not rejected';
  end if;
end $$;

select 'PASS: payment card funding/installment evidence persists independently' as result;
