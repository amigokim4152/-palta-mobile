-- PALTA CARE TRACK START IDEMPOTENCY PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- A mobile/offline retry of the same confirmed action must reuse the same Care
-- track rather than creating parallel lifecycle records. The idempotency key is
-- scoped to the authenticated user and is not a domain payload or secret.

alter table care_track
  add column if not exists client_request_id text;

do $$
begin
  alter table care_track
    add constraint care_track_client_request_id_len_chk
    check (
      client_request_id is null
      or length(trim(client_request_id)) between 1 and 240
    );
exception when duplicate_object then null;
end $$;

create unique index if not exists care_track_user_client_request_uq
  on care_track(user_id, client_request_id)
  where client_request_id is not null;

-- The client never chooses care_track.state directly. Server application logic
-- maps a safe start mode to the internal state:
--   discover         -> discovered
--   confirmed_action -> action_started
