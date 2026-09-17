# Provider Role Matrix v3

| Role | Current first candidate | Secondary/fallback | Palta-owned contract |
|---|---|---|---|
| Auth | Supabase Auth | Clerk / OIDC | AuthPort |
| Database | Supabase Postgres | Neon Postgres | DatabasePort / CommerceRepository |
| Object storage | Cloudflare R2 | S3-compatible / Supabase Storage | ObjectStoragePort |
| Edge API | Cloudflare Workers | Node/Vercel/self-hosted | EdgeRuntimePort |
| Async queue | Cloudflare Queues | provider-neutral queue / DB Outbox dispatch | Event/Outbox transport contract |
| Secret store | Cloudflare/Supabase managed server secrets as applicable | hosting/KMS alternative | secret boundary policy |
| Observability | provider-neutral metrics/log/error adapter; provider to be selected at deployment gate | alternate OpenTelemetry-compatible sink | operational telemetry contract |
| Notifications | Expo Notifications | OneSignal / direct APNs+FCM | NotificationPort |
| Local KV/session helper | Expo SecureStore/AsyncStorage | platform alternative | KeyValueStorePort |
| Offline queue | Expo SQLite | SQLite-compatible local DB | MutationQueueStore |
| Map renderer | MapLibre RN | alternative renderer if needed | MapCoreAdapter |

## Commerce runtime rule

For POS / Payment / Chile Fiscal, provider roles do not own canonical business state.

- Postgres owns durable transactional truth.
- Durable DB Outbox owns pending asynchronous responsibility until acknowledged.
- Async queue transports/retries work but is not canonical truth.
- Object storage archives fiscal artifacts but does not own payment/sale state.
- Secret stores hold provider/SII credentials server-side only.
- Observability receives minimized telemetry, never raw restricted payment data or unnecessary DTE/person data.

**Current provider choice is operational, not constitutional.**
