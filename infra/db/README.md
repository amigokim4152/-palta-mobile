# DB preflight

Primary v1 provider remains **Supabase Postgres/PostGIS**. Neon remains a fallback; do not run both databases in parallel for v1.

## Community migration path

`infra/db/migrations` contains the Community branch's database artifacts, but the live `palta-dev` migration history is the authority because Auth/Commerce/Business workstreams also apply migrations to the shared development project.

1. `0001_core_preflight.sql` — canonical entity/place/business, Care and Home foundations.
2. `0002_access_boundary_preflight.sql` — Supabase RLS/Data API access boundary.
3. `0003_community_preflight.sql` — Community spaces, memberships, posts, structured school items, comments, reactions, idempotency receipts and transactional outbox.
4. `0004_community_access_boundary_preflight.sql` — server-only Community persistence boundary including `community_school_item`.
5. `0005_auth_profile_preflight.sql` — **legacy draft/reference only; do not apply to normalized palta-dev**. It models the older provider-subject → `palta_private.identities` path and is superseded by the Auth/Profile normalized runtime where `public.palta_account.user_id = auth.users.id`.
6. `0006_community_runtime_hardening.sql` — covering indexes required by the first palta-dev Community performance-advisor pass.
7. `0007_community_outbox_delivery_hardening.sql` — claim lease, retry/backoff, publish and dead-letter state for Community event delivery.
8. `0008_community_normalized_identity_boundary.sql` — Community user references bound to canonical `public.palta_account(user_id)` plus covering indexes.

`infra/postgres/001_auth_profile_core.sql` is also a staging/reference artifact and must not create a second identity path in normalized palta-dev.

## palta-dev verification status — 2026-09-18

The Community persistence slice is applied and verified on the actual **palta-dev** Supabase project:

- `community_preflight` applied.
- `community_access_boundary_preflight` applied.
- `community_fk_indexes` applied from `0006_community_runtime_hardening.sql`.
- `community_outbox_delivery_hardening` applied from `0007_community_outbox_delivery_hardening.sql`.
- `community_normalized_identity_boundary` applied from `0008_community_normalized_identity_boundary.sql`.
- All eight `community_*` tables have RLS enabled.
- `anon` and `authenticated` have no direct Community table privileges; `service_role` remains the server-side persistence path.
- All Community user references now resolve to canonical `public.palta_account(user_id)` rather than provider-specific subjects.
- The performance advisor reports no Community unindexed-foreign-key finding after the hardening migrations.

The Supabase security advisor reports `RLS Enabled No Policy` as INFO for Community tables. That is intentional for this server-only boundary: no permissive Data API policy should be added merely to silence the advisory. Existing project-wide PostGIS/security advisories belong to shared infrastructure and are not introduced by Community.

## Verified database smokes

All database smokes use transactions and roll back their fixtures.

- `infra/db/tests/community_runtime_smoke.sql` — membership, structured schedule/supplies/child notice, acknowledgement, recipient scoping and duplicate protection.
- `infra/db/tests/community_outbox_delivery_smoke.sql` — `FOR UPDATE SKIP LOCKED`, live-lease protection, retry scheduling/reclaim and publication.
- `infra/db/tests/community_normalized_identity_smoke.sql` — synthetic `auth.users` → bootstrap trigger → `public.palta_account` → school admin/guardian → approval → private child notice → acknowledgement. The same smoke was executed against palta-dev and left `auth.users`, `palta_account` and Community fixture counts at zero after rollback.

A synthetic Auth fixture proves the server/database contract only. It does **not** replace Golden User 001's final real Magic Link mobile login/relaunch/logout/re-login verification.

## Canonical identity rule

Normalized v1 identity is:

`verified Supabase auth.users.id` → `public.palta_account.user_id` → private Palta domain services.

- Apple/Google/email provider subjects remain upstream Auth concerns and are not re-resolved by Community.
- `src/auth/canonicalAccount.ts` makes the Auth broker ID → canonical Palta ID conversion explicit.
- `infra/api/paltaIdentityResolver.ts` validates a bearer token through the server Auth verifier, verifies the canonical account exists and is active, then passes the same UUID into Community.
- Mobile clients never choose or submit a canonical `palta_user_id` for private mutations.

## Community server authorization

`infra/api/supabaseCommunityAuthorization.ts` is the server authorization adapter:

- private thread/comment/reaction access requires an active, non-ended membership;
- `leader`/`admin` are the membership-management roles;
- blocked/removed relationships cannot silently rejoin;
- invite-only spaces require an invitation;
- ended relationships immediately lose private interaction access.

`tests/community-http-golden-flow-tests.ts` now exercises the HTTP boundary through:

bearer identity → pending join → admin queue → guardian self-approval denied → admin approval → guardian role → recipient-scoped child notice → acknowledgement → relationship end → access denied.

The test also verifies that the server Supabase Auth adapter surfaces the verified `auth.users.id` and that an inactive canonical Palta account fails closed.

## Community → Home/Event bridge

Community does not create a second notification or Home system.

- `src/community/communityHomeProjection.ts` projects authorized structured school items into the shared `HomeCandidate` contract and existing `notification.candidate` Event type.
- General announcements and schedules remain Home-only by default.
- Required supplies and recipient-scoped child notices become action candidates; only sufficiently urgent actions may become `home_notify` through the shared delivery policy.
- Child notices fail closed when recipient or current relationship does not match.
- Disabling push does not remove a useful Home card.
- Overdue unresolved actions remain visible until acknowledgement/completion.
- `src/community/communityOutboxProcessor.ts` orchestrates claim → current recipient re-hydration → idempotent Home upsert → optional EventBus publish → published/retry/dead-letter.

## Runtime composition

`infra/api/communityRuntime.ts` is the canonical host-neutral server composition point for `/v1/community/*`.

The existing `infra/cloudflare/src/index.ts` is a PMTiles/map Worker and must not become an accidental all-purpose private API host. A dedicated API host can inject the concrete Community repository, authorization adapter, Supabase bearer verifier and identity store into `createCommunityHttpRuntime(...)` without changing domain logic.

## Remaining real E2E gate

Community is no longer blocked on schema, normalized identity mapping, authorization policy, HTTP route behavior, or Golden-flow contract tests. The remaining external/runtime gate is:

1. create a **real** palta-dev session through Golden User 001 Magic Link;
2. confirm the Auth bootstrap creates the same UUID in `public.palta_account`;
3. host/wire `createCommunityHttpRuntime(...)` with the concrete server SQL/Auth adapters;
4. run the same join → approval → school item → acknowledgement flow over the live API using that real session;
5. attach the concrete outbox store/hydrator/Home sink to the already-defined processor ports.

Do not mark Golden User Gate 01 or Community live E2E complete until the user-driven mobile Auth cycle and live API request path have both been observed.
