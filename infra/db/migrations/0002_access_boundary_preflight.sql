-- PALTA SUPABASE ACCESS BOUNDARY PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Checked against current Supabase RLS/Data API guidance on 2026-09-16.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

alter table public.canonical_entity enable row level security;
alter table public.place enable row level security;
alter table public.business enable row level security;
alter table public.care_track enable row level security;
alter table public.home_candidate enable row level security;

grant select on table public.canonical_entity to anon, authenticated;
grant select on table public.place to anon, authenticated;
grant select on table public.business to anon, authenticated;

grant select, insert, update, delete on table public.canonical_entity to service_role;
grant select, insert, update, delete on table public.place to service_role;
grant select, insert, update, delete on table public.business to service_role;

create policy canonical_entity_public_read
  on public.canonical_entity
  for select
  to anon, authenticated
  using (status = 'active');

create policy place_public_read
  on public.place
  for select
  to anon, authenticated
  using (true);

create policy business_public_read
  on public.business
  for select
  to anon, authenticated
  using (verification_status <> 'suspended');

grant select on table public.care_track to authenticated;
grant select on table public.home_candidate to authenticated;
grant select, insert, update, delete on table public.care_track to service_role;
grant select, insert, update, delete on table public.home_candidate to service_role;

create index if not exists care_track_user_id_idx
  on public.care_track(user_id);
create index if not exists home_candidate_user_id_idx
  on public.home_candidate(user_id);

create policy care_track_owner_read
  on public.care_track
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy home_candidate_owner_read
  on public.home_candidate
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- No authenticated INSERT/UPDATE/DELETE policies intentionally.
-- Side-effecting actions enter through the Palta API and are audited server-side.
