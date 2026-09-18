# Palta Auth/Profile Persistence v1

## Scope

This layer persists Palta-owned account identity separately from authentication providers.

Canonical flow:

`provider principal -> provider identity lookup -> Palta account -> Core Profile`

A provider account, OAuth subject, Supabase Auth user ID, Apple ID, Google ID or email address is never the canonical Palta person identifier.

## Account resolution

The only automatic existing-account lookup key is:

`provider + providerSubject`

A matching email address is not sufficient to merge two Palta accounts. This avoids silent account takeover or accidental cross-provider merging.

If a user is already authenticated to a Palta account, another verified identity may be explicitly linked to that account. An identity already owned by another Palta account cannot be reassigned through the normal linking path.

## Storage boundary

The baseline PostgreSQL schema lives in `palta_private` and is server-only.

Tables:
- `accounts`
- `identities`
- `core_profiles`
- `consents`
- `life_areas`
- `visible_profiles`

The schema revokes `PUBLIC` access and must not be exposed directly through a browser/mobile database client or general analytics pipeline.

The app/server talks to it through `DatabasePort` and `AccountPersistencePort`, keeping the concrete database provider replaceable.

## Provider adapter boundary

An auth adapter must produce a verified `ProviderPrincipal` containing:
- provider namespace
- stable provider subject
- authentication timestamp
- verified-email flag
- verified email only when the provider has actually verified it
- optional provider session ID

Never use provider user-editable metadata for authorization decisions.

## Identity linking

Rules:
- multiple identities per Palta account are supported
- linking requires a currently authenticated Palta account
- sensitive linking/unlinking actions require fresh authentication
- a provider identity cannot be silently moved between Palta accounts
- the last active identity cannot be revoked
- revocation is enforced again inside the persistence transaction to protect against races

## Session policy

Routine sign-out terminates only the current session.

All sessions are terminated for:
- credential/security-sensitive change
- suspected account compromise
- account recovery
- account deletion

For sensitive operations, server-side validation may additionally verify that the provider session is still active because a revoked JWT can remain usable until its access-token expiry.

## Onboarding

A new authenticated account may enter Palta Home immediately.

Preferred name and home commune remain optional progressive-profile prompts. Skipping them does not block account use.

## Supabase readiness

Supabase can satisfy the auth/database adapter boundaries, but no Supabase project is currently connected to this workspace. The current implementation therefore keeps Supabase-specific SDK code and secrets out of Core.

When a project is provisioned:
1. keep `palta_private` outside the exposed Data API schema
2. never put `service_role`/secret keys in mobile or web clients
3. map provider identities to `ProviderPrincipal`
4. enable/manual-test identity linking behavior before release
5. validate RLS/exposure and security advisors after applying provider-specific migrations
6. use current-session sign-out for routine logout and global revocation for security/account lifecycle events

## Acceptance

- same provider subject resolves to the same Palta account
- matching email alone does not merge accounts
- identity collision across accounts is blocked
- initial account creation is atomic across account/identity/profile
- last-active-identity rule is enforced in persistence
- optional onboarding does not block Home
- session termination scope is explicit
- provider/database implementations remain replaceable
