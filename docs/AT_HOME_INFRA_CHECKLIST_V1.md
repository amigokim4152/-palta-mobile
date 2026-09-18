# AT-HOME INFRASTRUCTURE CHECKLIST v1

> Runtime/storage authority: `docs/PALTA_PLATFORM_RUNTIME_FOUNDATION_V1.md` and `config/runtime-environments.v1.json` now supersede this checklist for service ownership, environment separation, API boundary and resource IDs. This file remains the low-cost execution checklist.

Do in this order. Do not buy paid plans until the related gate fails.

## A. GitHub — first
- Reconnect ChatGPT/GitHub access.
- Verify repository `amigokim4152/-palta-mobile`.
- Keep `main` unchanged.
- Work in integration branch.
- Upload/apply `palta-app-prep-v2`.
- Run install, typecheck, core tests, then GitHub Actions.
- Any environment failure = NOT VERIFIED, never PASS.

## B. Expo
- Create/confirm Expo account.
- Create Palta EAS project only after repository scaffold is ready.
- Start on Free plan.
- Use Development Build because MapLibre React Native cannot run inside Expo Go.
- Do not subscribe to Starter until Free build limits or queue actually blocks work.

## C. Supabase
Current connector check on 2026-09-17: connected, one accessible organization (`kimeuisin@gmail.com's Org`), **0 projects**.

When ready:
- Use the explicitly approved Supabase organization.
- Create one development project only after current cost is shown and explicitly confirmed.
- Region target for Chile pilot: `sa-east-1` unless the live creation-time constraints require another documented choice.
- Enable PostGIS only when a canonical feature actually requires DB-side geospatial queries; public map tiles remain outside transactional DB.
- Keep RLS on for exposed/user/private tables and use least-privilege server roles.
- Public canonical data and private personal data must use separate access policies/boundaries.
- Do not place service-role secrets in Expo client env.
- Mobile uses Supabase Auth/publishable credentials only where defined by the runtime foundation; money/fiscal/provider operations go through Palta API/worker boundaries.

No production project/upgrade yet.

## D. Cloudflare
- Confirm existing account/project access.
- Verify Workers, R2 buckets, routes, Hyperdrive bindings, Queues and secret/KMS boundary.
- Keep public/static canonical release in R2.
- Keep provider credentials behind Workers/payment secret boundary, not in mobile client.
- Confirm current map/data endpoints before wiring mobile.
- Record actual DEV/STAGING/PROD resource identifiers in `config/runtime-environments.v1.json`; do not leave them only in personal notes.

## E. Push
- Start with Expo Push Service.
- Register iOS/Android push credentials when native dev build exists.
- Store device tokens server-side.
- Route all pushes through Palta Event/Notification policy.
- Do not create OneSignal account for v1 unless a concrete lifecycle-messaging requirement appears.

## F. Sentry
- Create project only after first runnable native build.
- Enable crash/error tracking first.
- Disable/scrub sensitive user data.
- Do not enable broad session replay of private Home/health/school screens by default.

## G. Resend
- Defer until an email flow is actually needed.
- Then add `somospalta.cl` sending domain, DNS verification, and one transactional template.
- Keep marketing and transactional email separated.

## H. Reserved, not active
- Neon: PostgreSQL portability/fallback option. Current connected account check on 2026-09-17 found **0 projects**; do not create unless fallback/migration testing becomes justified.
- Clerk: alternative Auth.
- Meilisearch/Algolia: later search scaling.
- OneSignal: later lifecycle messaging.

This checklist intentionally reduces initial accounts and monthly fixed cost. Service ownership and production gates are defined by the runtime foundation contract.
