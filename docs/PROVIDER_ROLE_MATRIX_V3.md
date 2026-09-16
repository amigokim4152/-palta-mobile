# Provider Role Matrix v3

| Role | Current first candidate | Secondary/fallback | Palta-owned contract |
|---|---|---|---|
| Auth | Supabase Auth | Clerk / OIDC | AuthPort |
| Database | Supabase Postgres | Neon Postgres | DatabasePort |
| Object storage | Cloudflare R2 | S3-compatible / Supabase Storage | ObjectStoragePort |
| Edge API | Cloudflare Workers | Node/Vercel/self-hosted | EdgeRuntimePort |
| Notifications | Expo Notifications | OneSignal / direct APNs+FCM | NotificationPort |
| Local KV/session helper | Expo SecureStore/AsyncStorage | platform alternative | KeyValueStorePort |
| Offline queue | Expo SQLite | SQLite-compatible local DB | MutationQueueStore |
| Map renderer | MapLibre RN | alternative renderer if needed | MapCoreAdapter |

**Current provider choice is operational, not constitutional.**
