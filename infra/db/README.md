# DB preflight

Primary v1 provider remains **Supabase Postgres/PostGIS** as decided in v2.1. Neon remains a fallback; do not run both databases in parallel for v1.

## Canonical migration path

`infra/db/migrations` is the single preflight migration sequence for the shared Palta database:

1. `0001_core_preflight.sql` — canonical entity/place/business, Care and Home foundations.
2. `0002_access_boundary_preflight.sql` — Supabase RLS/Data API access boundary.
3. `0003_community_preflight.sql` — Community spaces, memberships, posts, comments, reactions, idempotency receipts and transactional outbox.

All files are review artifacts and are **NOT APPLIED** yet. They remain Postgres-compatible where practical.

`infra/postgres` contains auth/profile work produced by the authentication workstream. It is not a second production database or a second migration runner. Its identity model must be reconciled into this canonical migration sequence before any production migration is applied. New domain persistence should not create another parallel migration root.

## Access rules

- Mobile clients use the Palta API boundary for side-effecting actions; they do not write Community tables directly.
- Authenticated identity is resolved by the session/API boundary, never chosen by a mutation payload.
- Public canonical data and private/personal data remain explicitly separated.
- Community reads require membership/audience/moderation filtering.
- Community mutations and their outbox events are committed atomically; idempotency receipts protect retries.

## Do not apply until

1. Supabase development project is deliberately selected/created.
2. The auth/profile identity migration is reconciled with the UUID user IDs already used by the core DB preflight.
3. Community RLS/server-only grants are reviewed together with `0002_access_boundary_preflight.sql`.
4. Migration validation is run against a disposable development database.
