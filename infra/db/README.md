# DB preflight

Primary v1 provider remains **Supabase Postgres/PostGIS** as decided in v2.1. Neon remains a fallback; do not run both databases in parallel for v1.

## Canonical migration path

`infra/db/migrations` is the single preflight migration sequence for the shared Palta database:

1. `0001_core_preflight.sql` — canonical entity/place/business, Care and Home foundations.
2. `0002_access_boundary_preflight.sql` — Supabase RLS/Data API access boundary.
3. `0003_community_preflight.sql` — Community spaces, memberships, posts, structured school items, comments, reactions, idempotency receipts and transactional outbox.
4. `0004_community_access_boundary_preflight.sql` — server-only Community persistence boundary including `community_school_item`.
5. `0005_auth_profile_preflight.sql` — canonical Palta account/profile identity using UUID `palta_user_id`, provider identity bindings, and private-domain identity foreign keys.
6. `0006_community_runtime_hardening.sql` — covering indexes required by the first palta-dev Community performance-advisor pass.
7. `0007_community_outbox_delivery_hardening.sql` — claim lease, retry/backoff, publish and dead-letter state for Community event delivery.

## palta-dev verification status — 2026-09-18

The Community persistence slice is now applied and verified on the actual **palta-dev** Supabase project:

- Supabase migration `community_preflight` applied.
- Supabase migration `community_access_boundary_preflight` applied.
- Supabase migration `community_fk_indexes` applied from `0006_community_runtime_hardening.sql`.
- Supabase migration `community_outbox_delivery_hardening` applied from `0007_community_outbox_delivery_hardening.sql`.
- All eight `community_*` tables have RLS enabled.
- `anon` and `authenticated` have no direct table privileges on Community persistence.
- `service_role` retains the server-side persistence path.
- `community_school_item` is included in the same server-only access boundary.
- The transactional Golden School smoke in `infra/db/tests/community_runtime_smoke.sql` passes and rolls back all fixture rows.
- The Golden School smoke covers approval-shaped membership state, structured schedule/supplies/child notice data, acknowledgement reaction, recipient scoping, private child-notice constraints and duplicate structured-item protection.
- `infra/db/tests/community_outbox_delivery_smoke.sql` verifies `FOR UPDATE SKIP LOCKED` claiming, live-lease protection, delayed retry, reclaim after retry becomes due, publication and rollback.
- The first performance-advisor pass found four Community foreign keys without covering indexes; `0006` fixed all four. Subsequent advisor output has no Community unindexed-FK finding.

The Supabase security advisor reports `RLS Enabled No Policy` as INFO for these Community tables. That is expected for this boundary: Community intentionally has no `anon`/`authenticated` grants or policies because all reads and mutations are mediated by the Palta API. Do not add permissive Data API policies merely to silence that INFO advisory.

Other database workstreams have their own migration history in palta-dev. Do not assume the numbered preflight filename alone proves an identical SQL artifact was applied; verify the remote migration history and schema before changing shared tables.

`infra/postgres/001_auth_profile_core.sql` is a staging/reference artifact from the authentication workstream. Its useful domain shape is reconciled into canonical migration `0005`, but the staging file itself must not be applied. It uses text IDs and would create a conflicting second identity path.

## Community → Home/Event bridge

Community does not create a second notification or Home system.

- `src/community/communityHomeProjection.ts` projects authorized structured school items into the shared `HomeCandidate` contract and the existing `notification.candidate` Event Core type.
- General announcements and schedule entries remain Home-only by default.
- Required supplies and recipient-scoped child notices become action candidates; the shared delivery policy may promote them to `home_notify` only when urgency reaches the threshold (for example, due within 48 hours).
- Child notices fail closed when the recipient does not match or the current school relationship is inactive.
- Disabling push does not remove a useful Home card.
- Overdue unresolved actions remain visible until acknowledgement/completion rather than disappearing at `dueAt`.
- `src/community/communityOutboxProcessor.ts` defines the processor orchestration: claim → re-hydrate current authorized recipients → idempotent Home upsert → optional EventBus publish → published/retry/dead-letter result.
- `src/community/communityOutboxDelivery.ts` keeps retry/backoff and lease policy independent from the storage adapter.

## Canonical identity rule

- `palta_user_id` is a Palta-owned UUID and is the canonical private-domain identity.
- Apple/Google/email/phone provider subjects are login bindings only; they never become `palta_user_id`.
- TypeScript/API layers may serialize the UUID as `string`, but persistence validates/stores it as PostgreSQL `uuid`.
- The authenticated API boundary verifies the bearer session, resolves its provider subject to one active Palta identity, then passes only canonical `palta_user_id` into Home/Care/Community application services.
- Mobile clients never choose or submit `palta_user_id` for private mutations.

## Access rules

- Mobile clients use the Palta API boundary for side-effecting actions; they do not write Community tables directly.
- Authenticated identity is resolved by the session/API boundary, never chosen by a mutation payload.
- Public canonical data and private/personal data remain explicitly separated.
- Community reads require membership/audience/moderation filtering.
- Community mutations and their outbox events are committed atomically; idempotency receipts protect retries.
- `palta_private` identity/profile tables are server-only and granted to `service_role`, not `anon` or `authenticated` clients.

## Next end-to-end gate

The Community schema and event projection are no longer blocked on table creation or delivery policy. The next gate is real identity/runtime integration:

1. Complete a real palta-dev authenticated account/session.
2. Resolve provider subject → canonical Palta UUID through the existing identity boundary.
3. Exercise Community authorization and transaction adapters with that real identity.
4. Run join request → approval → role assignment → structured school item → acknowledgement through the actual HTTP/API runtime, not direct SQL.
5. Wire a concrete server-side Community outbox store/hydrator/Home sink to the processor ports and run the worker against palta-dev.
