# Palta Social Auth Provider Setup

Status: PROVIDER CREDENTIALS REQUIRED
Environment: `palta-dev` first, production later
Supabase project ref: `rqbpbauhkdgsrkbwmkmg`

This document records the provider-side work required to turn on Apple and Google login. Do not add placeholder client IDs/secrets to Supabase merely to make the buttons appear. The mobile runtime reads the live Supabase Auth capability state and only exposes enabled providers.

## Fixed Palta identifiers

- iOS bundle identifier: `cl.somospalta.app`
- Android package: `cl.somospalta.app`
- Palta app callback after Supabase Auth: `palta://auth/callback`
- Supabase hosted OAuth callback registered with external providers:
  - `https://rqbpbauhkdgsrkbwmkmg.supabase.co/auth/v1/callback`

These two callbacks have different roles:

1. Google/Apple redirects back to the **Supabase hosted callback**.
2. Supabase then redirects back to the **Palta custom scheme** when Palta requested `redirectTo=palta://auth/callback`.

The Palta custom callback must also be present in the Supabase Auth redirect allow list before provider E2E is considered complete.

## Current `palta-dev` state — 2026-09-18

- Email Auth: enabled
- Apple: disabled
- Google: disabled

The mobile Auth screen therefore currently exposes email and hides Apple/Google. This is intentional fail-safe behavior, not a UI omission.

## Google

### Credentials required

Create/select the Somos Palta Google Cloud / Google Auth Platform project and configure the consent screen/audience/scopes.

Minimum scopes required by Supabase Auth:

- `openid`
- user email
- user profile

For the browser OAuth path currently implemented in the Palta mobile adapter, create a **Web application OAuth client** and register this authorized redirect URI:

```text
https://rqbpbauhkdgsrkbwmkmg.supabase.co/auth/v1/callback
```

Store the resulting:

- Google Client ID
- Google Client Secret

Then configure Supabase Dashboard → Authentication → Providers → Google and enable the provider.

### Native mobile upgrade path

Supabase's current React Native guidance supports native Google sign-in using platform-specific Google client IDs and an ID token passed to Supabase `signInWithIdToken`.

For a later native UX pass:

- iOS client uses bundle id `cl.somospalta.app`
- Android client uses package `cl.somospalta.app` plus the correct development/production signing SHA-1 fingerprints
- register all required Google client IDs with the Supabase Google provider
- preserve nonce validation unless a platform/library limitation is explicitly verified

Do not turn off nonce checking as a generic fix.

## Apple

Supabase supports both browser OAuth and native Apple authentication. For Expo/iOS, Supabase recommends native Sign in with Apple as the preferred mobile path.

### Preferred iOS production path — native Apple sign-in

Required provider-side items:

1. Apple Developer account
2. App ID for `cl.somospalta.app`
3. Sign in with Apple capability enabled for that App ID
4. register the App ID/client ID in Supabase Authentication → Providers → Apple
5. mobile runtime obtains the Apple identity token and exchanges it with Supabase using `signInWithIdToken`

Native-only Apple sign-in does not require the web OAuth client-secret rotation described below.

Apple only returns the user's full name on the first authorization. Palta must never depend on Apple returning the name again. Canonical profile completion remains a separate Palta profile concern.

### Browser OAuth path — required only if Palta keeps Apple OAuth on non-iOS/web-style flows

Provider-side items:

1. Apple Developer Team ID
2. App ID with Sign in with Apple
3. Services ID
4. Website domain for the Services ID:
   - `rqbpbauhkdgsrkbwmkmg.supabase.co`
5. Return URL:
   - `https://rqbpbauhkdgsrkbwmkmg.supabase.co/auth/v1/callback`
6. Apple signing Key (`.p8`)
7. generated Apple client secret
8. Services ID/client ID and generated secret configured in Supabase Apple provider

For this OAuth mode Apple requires periodic client-secret rotation (currently every six months). If this mode is retained, secret rotation must be an operational task with an explicit reminder/owner; otherwise Apple login will eventually fail.

Never commit `.p8`, Google/Apple client secrets, Supabase Management API tokens, or service-role keys into this repository or any `EXPO_PUBLIC_*` variable.

## Enabling a provider safely

For each provider:

1. obtain the real provider credentials
2. configure the provider in `palta-dev`
3. verify public readiness:

```bash
node --env-file=.env.example scripts/check-supabase-auth-public-settings.mjs google
node --env-file=.env.example scripts/check-supabase-auth-public-settings.mjs apple
```

4. run the mobile runtime:

```bash
./scripts/run-ios-mobile.sh
```

5. confirm the provider button appears only after Supabase reports it enabled
6. complete login
7. confirm the resulting `PaltaUserId`
8. sign out and sign in again
9. confirm the same canonical account is resolved
10. verify linking another provider does not create an unintended duplicate Palta account

Do not call a provider production-ready merely because the Supabase toggle is on.

## Production promotion requirements

Before enabling Apple/Google in production:

- production Supabase project/provider configuration is separate from `palta-dev`
- production redirect allow list is explicit
- provider branding/consent screen uses Somos Palta rather than a raw development project identity where practical
- privacy policy and terms URLs required by the provider are published
- development and production credentials are separate
- secrets are stored in provider/Supabase secret configuration, never mobile public config
- provider outage/failure remains visible to the user and does not bypass canonical account/RLS resolution
- provider-specific account linking is tested against an existing Palta user
- Apple OAuth secret rotation is scheduled if OAuth mode is used

## Current Gate 01 rule

Apple/Google provider credentials are **not** required to finish the current Golden User Gate 01 because email Auth is enabled and is the selected executable path. Gate 01 still requires real simulator/device evidence for email login → relaunch → logout → login again.

Apple/Google become separate provider-readiness checks when their real credentials are available; they must not hold the basic canonical Auth runtime hostage, and disabled providers must not appear as broken login choices.
