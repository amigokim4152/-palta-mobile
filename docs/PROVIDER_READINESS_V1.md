# PROVIDER READINESS MATRIX v1

Date: 2026-09-16
Goal: minimum-provider, low-cost, replaceable infrastructure for first Palta mobile build.

| Capability | Initial choice | Current prep status | Why / limit | When paid |
|---|---|---|---|---|
| Source control / CI | GitHub | ACCOUNT/REPO EXISTS, practical connection pending | Existing repo; Actions can validate integration branch | Private repo usage beyond included minutes |
| Mobile framework/build | Expo + React Native + Expo Router | SIGN-UP / PROJECT NOT VERIFIED | SDK 57 current docs; deep links/native navigation; free EAS tier | Starter only if build quota/priority needed |
| Database + Auth + Realtime | Supabase | VERIFIED: FREE ORG, 0 PROJECTS, NEW PROJECT QUOTE $0/MO | One provider replaces separate Neon+Clerk for v1; Postgres/PostGIS/Auth/RLS/Realtime | Move to Pro before serious production because Free pauses and lacks automatic backups |
| Edge/cache/public API | Cloudflare Workers | CONNECTION NOT VERIFIED IN CHAT | Good fit for canonical public APIs, cache, collectors | Workers Paid min $5/mo only when Free limits require |
| Object/data storage | Cloudflare R2 | CONNECTION NOT VERIFIED IN CHAT | 10 GB-month free + no egress; existing architecture already expects R2 | Usage above free storage/ops |
| Map runtime | MapLibre React Native | PACKAGE/DEV BUILD NOT VERIFIED | Open stack; shared Map Core; requires custom native build, not Expo Go | Tile/geocoder/routing provider costs only if used |
| Push | Expo Push Service | NOT CONFIGURED | $0 service; enough for first launch; 600 notifications/sec/project | No service fee; revisit direct FCM/APNs/OneSignal only when needed |
| Error/performance | Sentry | ACCOUNT/PROJECT NOT VERIFIED | Add after first dev build; scrub personal data | Paid only if free quotas/team features insufficient |
| Transactional email | Resend | ACCOUNT/DOMAIN NOT VERIFIED | Free 3,000/mo, 100/day; only for actual transactional needs | Pro $20/mo if volume requires |
| Search | PostgreSQL FTS + pg_trgm | SUPABASE PROJECT REQUIRED | Avoid separate search provider early | Meilisearch/Algolia only after measured need |
| DB fallback | Neon | VERIFIED CONNECTED: FREE ORG `kim`, 0 PROJECTS; RESERVED ONLY | São Paulo (`aws-sa-east-1`) available; do not run in parallel for v1 | Provision only when resilience/independence justifies it |
| Advanced lifecycle messaging | OneSignal | DEFER | Free mobile push now limited to 1,000 MAU; unnecessary while Expo Push works | Revisit for Journeys/marketing automation |

## Decision change from older infrastructure draft

For v1, use **Supabase as the initial operational Postgres + Auth + Realtime provider** instead of provisioning both Neon and Clerk immediately.

Reason:
- Fewer accounts and adapters for one-person operations.
- Free tier currently includes 50k MAU Auth, 500 MB DB, 5 GB egress, 1 GB storage, Realtime and PostGIS support.
- React Native / Expo quickstarts are first-party documented.
- Palta still owns authorization and canonical contracts; provider can be replaced later.

Neon remains a reserved DB fallback. The account is now connected and verified with a Free organization (`kim`), zero projects, and São Paulo region availability; no Neon project has been created. Clerk remains a reserved Auth alternative only if Supabase Auth later fails a real product requirement.

## Production caution

Supabase Free pauses after one week of inactivity and does not include automatic backups. It is appropriate for development/pilot, not the final production resilience standard.
