# AT-HOME INFRASTRUCTURE CHECKLIST v1

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
Current connector check: connected, **Free organization verified, 0 projects, new project quote USD 0/month**.

When ready:
- Choose the correct Supabase organization.
- Create one development project.
- Region preference for Chile pilot: evaluate `sa-east-1` latency/availability at creation time.
- Enable PostGIS.
- Keep RLS on for user/private tables.
- Public canonical data and private personal data must use separate policies/schemas.
- Do not place service-role secrets in Expo client env.

No production upgrade yet.

## D. Cloudflare
- Confirm existing account/project access.
- Verify Workers, R2 buckets, routes, and secrets.
- Keep public/static canonical release in R2.
- Keep provider credentials behind Workers/collectors, not in mobile client.
- Confirm current map/data endpoints before wiring mobile.

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
- Neon: DB fallback. Account connected, Free org `kim`, 0 projects, São Paulo available; do not create unless fallback becomes justified.
- Clerk: alternative Auth.
- Meilisearch/Algolia: later search scaling.
- OneSignal: later lifecycle messaging.

This checklist intentionally reduces initial accounts and monthly fixed cost.
