-- PALTA OUTBOX DISPATCHER ACCESS PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Recovery dispatcher only discovers due Outbox IDs and republishes them to
-- Cloudflare Queues. It does not own payment/fiscal side effects and therefore
-- receives read-only access to commerce_outbox.

do $$
begin
  create role palta_outbox_dispatcher nologin;
exception
  when duplicate_object then null;
end $$;

grant usage on schema public to palta_outbox_dispatcher;
grant select on public.commerce_outbox to palta_outbox_dispatcher;

create policy commerce_outbox_dispatcher_select
  on public.commerce_outbox
  for select
  to palta_outbox_dispatcher
  using (true);

-- No INSERT/UPDATE/DELETE grants intentionally.
-- Queue publication is allowed to duplicate because consumers acquire the
-- canonical DB lease via OutboxRepository.claimEvent() before side effects.
