# Palta Auth & Progressive Profile Core v1

## Purpose

Define the provider-independent account, identity and progressive profile boundary for Palta.

Authentication proves who is signing in. It does not define the Palta person model.

`provider identity -> Palta account -> person/profile -> domain relationships`

Provider identifiers must never become the canonical Palta user identity.

## Canonical identity

Every account receives one stable `paltaUserId`.

One Palta account may link multiple login identities:
- Apple
- Google
- email
- phone (future/optional)

Losing or changing a login method must not change the canonical Palta account, Home history, Care state, community relationships, orders or other domain records.

An identity cannot be unlinked if it is the account's last active sign-in method.

## Initial sign-in methods

Recommended first release:
1. Continue with Apple
2. Continue with Google
3. Continue with email using magic link or one-time code

Password-first registration is not a product requirement.

The concrete auth provider remains behind ports/adapters. Palta Core must not import provider SDKs.

## Initial onboarding

Required at account creation:
- authentication proof
- required legal/privacy consent versions
- locale/timezone defaults when available

Optional and skippable:
- preferred name
- home commune / primary local area

Do not require at initial onboarding:
- sex/gender
- birth date
- RUT
- phone number
- exact home address
- occupation
- family structure
- school relationship
- vehicle
- pet
- health details

After the minimum onboarding step, enter Palta Home.

## Progressive profile rule

Palta does not ask, "Tell us everything about you."

A profile request must have:
- a specific purpose
- a user-visible benefit
- the minimum required data class/precision
- a surface/context
- explicit blocking vs skippable behavior

Sensitive personal fields are prohibited from initial onboarding.

Examples:
- school feature -> ask for the relevant school/child relationship
- vehicle reminders -> ask for vehicle data
- delivery/visit -> ask for precise address only for that action
- health feature -> collect health data inside the health boundary, not Core Profile

## Profile boundaries

`CoreProfile` contains only lightweight presentation and locale information.

Not embedded in Core Profile:
- household/family relationships
- user roles
- organization memberships
- owned/managed things
- health data
- financial data

Those remain separate domain relationships keyed by `paltaUserId`.

## Location

Current location, home area, work area, saved area and exploring area are distinct concepts.

GPS location must never be silently promoted to a home address.

Initial local personalization should prefer commune/neighborhood precision. Exact location/address is collected only when an action requires it.

## Private vs visible profile

Information known to Palta for personalization is not automatically visible to another person.

A `VisibleProfile` is scope-specific. The same person may use different presentation identities in different contexts, for example school, neighborhood or business spaces.

Private profile data and visible community identity must remain separate storage and authorization concerns.

## Sensitive domain boundaries

Health and financial data are separate from Core Profile and general analytics.

General personalization should consume only the minimum derived signal required for a decision where possible, rather than raw sensitive payloads.

## Account recovery and lifecycle

Required design properties:
- multiple linked identities supported
- account takeover defenses
- session revocation
- last-login-method protection
- account export path
- deletion workflow with domain retention rules
- audit trail for sensitive account changes

## Independence gate

Core types and policies must remain provider-neutral.

Apple, Google, Supabase Auth, custom OIDC or another implementation may satisfy adapters without changing canonical account/profile contracts.

## First implementation acceptance

- stable `paltaUserId` separated from provider subject
- multiple identities modelled
- last identity cannot be removed
- Core Profile separated from domain facets
- sensitive fields blocked from initial onboarding
- initial profile prompts are optional/skippable
- provider-neutral identity/profile ports defined
- TypeScript verification passes
