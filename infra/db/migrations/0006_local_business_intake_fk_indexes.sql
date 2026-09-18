-- Cover the two canonical Business foreign keys used by registration review,
-- dedupe, promotion, and cleanup flows. Partial indexes keep the empty intake
-- case cheap while avoiding full-table scans once registrations accumulate.

create index if not exists business_registration_intake_existing_business_id_idx
  on public.business_registration_intake (existing_business_id)
  where existing_business_id is not null;

create index if not exists business_registration_intake_promoted_business_id_idx
  on public.business_registration_intake (promoted_business_id)
  where promoted_business_id is not null;
