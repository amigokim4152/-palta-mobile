# IMPLEMENTATION DECISIONS — 2026-09-16

1. Mobile target: Expo / React Native / Expo Router, current SDK 57 line.
2. Map: MapLibre React Native, which requires a custom development build; Expo Go is insufficient.
3. Bottom navigation remains Home / Neighborhood / Community / Market / Play.
4. Home is not a service menu. It is a private state/action feed.
5. Neighborhood uses shared Map Core + bottom sheet + synchronized list.
6. One canonical entity can appear on several surfaces; no surface-owned duplicates.
7. Initial backend simplification: Supabase for Postgres/PostGIS/Auth/Realtime, Cloudflare for edge/cache/R2.
8. Initial push: Expo Push Service, not OneSignal.
9. Initial search: Postgres FTS/pg_trgm, not Algolia.
10. GitHub main remains protected from unverified integration work.
11. Provider adapters remain explicit so the initial simplification does not become permanent lock-in.
12. Any unexecuted native build/provider connection remains NOT VERIFIED.
