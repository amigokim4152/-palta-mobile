# DB preflight

Primary v1 provider remains **Supabase** as decided in v2.1.

The SQL in `migrations/0001_core_preflight.sql` is:
- a review artifact
- NOT applied
- Postgres/PostGIS compatible
- intentionally portable to Neon fallback

Do not apply until:
1. GitHub integration branch is restored.
2. Supabase development project is deliberately created.
3. Auth/RLS policy draft is reviewed.
4. Public canonical data and private user data boundaries are explicit.

Neon is connected as a fallback account but has zero projects. Do not run both databases in parallel for v1.
