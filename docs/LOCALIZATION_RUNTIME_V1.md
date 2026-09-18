# Palta Localization Runtime V1

## Status

Source branch: `integration/localization-runtime-v1`.

This document defines the shared mobile localization contract. Feature branches should consume this contract instead of creating separate locale state, translation stores, or language persistence.

## Supported launch locales

- `es-CL` — Spanish (Chile), canonical default and final fallback
- `ko` — Korean
- `en` — English
- `zh-Hans` — Simplified Chinese

Legacy locale tags such as `ko-KR`, `en-US`, and `zh-CN` may be accepted at input boundaries and normalized to the canonical Palta locale. New application state must store only the canonical values above.

## Locale resolution order

1. Explicit account preference (`public.palta_account.preferred_locale` with `preferred_locale_explicit=true`)
2. Explicit language selected locally before sign-in
3. Device locale
4. `es-CL`

A language manually selected before authentication is promoted to the account preference after sign-in so the same choice can be restored on another device.

## Regional invariants

Display language must not change Chile product context:

- region: `CL`
- timezone: `America/Santiago`
- currency: `CLP`

Dates may use the selected display locale for formatting, but Chile/Santiago remains the product timezone unless a domain explicitly requires another timezone.

## Persistence

Local explicit selection is stored in secure local storage.

Signed-in explicit selection is stored on the Palta account through the locale preference port. `preferred_locale_explicit` distinguishes an actual user choice from the database's Spanish default.

The account row remains protected by the existing account RLS boundary; clients may only read or update their own preference.

## UI copy

Shared localization entrypoint: `src/localization/index.ts`.

Current catalogs:

- `uiCatalog.ts` — shell, auth, Home, Neighborhood, Community, business actions
- `discoveryCatalog.ts` — Market and Play
- `careCatalog.ts` — Care flow and timeline
- `surfaceCatalog.ts` — secondary routes and shared async states
- `businessCatalog.ts` — typed business status labels

Runtime interpolation uses named placeholders such as `{count}`, `{status}`, or `{id}`. Do not concatenate translated fragments when word order can differ between languages.

## Dynamic content

UI chrome and canonical enum labels are translated locally.

Server/user content must not be silently machine-translated in the UI layer. Use structured translations when the data contract provides them; otherwise show the canonical Spanish original. `contentResolver.ts` implements this fallback rule.

Home already sends the selected locale to `/v1/home?locale=...`, allowing the server to return localized content where available.

Taxonomy labels, business category labels, municipal/public content, events, news, and other data-driven content should expose localized display fields in their own data contracts rather than hard-coding translations into screens.

## Mobile integration

Use `useLocalization()` from `mobile-overlay/src/providers/LocalizationProvider.tsx`.

For shared UI keys:

```ts
const { locale, t } = useLocalization();
const title = t('home.sectionTitle');
const more = t('home.showMore', { count: 3 });
```

For feature catalogs use the same `locale` with the feature resolver (`discoveryT`, `careT`, `surfaceT`, etc.). There must be one active locale state for the app.

## Current connected surfaces

- authentication / sign-up
- bottom navigation
- language settings
- Home
- Neighborhood / map chrome
- Community
- Business detail and business actions
- Market and market vertical entry
- Play / discovery
- Care detail and timeline
- Search
- Context
- Shared map route
- Place route
- shared loading / error / retry states

`activity/[id]` is a compatibility alias to Care and does not own copy.

## Do not do

- Do not create a second locale provider inside a feature.
- Do not store `ko-KR`, `en-US`, or `zh-CN` as canonical Palta locale values.
- Do not infer region, currency, eligibility, or policy jurisdiction from display language.
- Do not translate user-entered text in the UI layer without an explicit translation workflow.
- Do not duplicate the canonical business, place, Care, or content object per language.
- Do not use a missing translation as a reason to show an empty UI; fall back to the Spanish original.

## Remaining data-contract work

The runtime localization foundation is separate from data localization. The remaining cross-domain work is to add localized display fields or translation objects to canonical data contracts for categories, opening-status labels, public benefits/services, events, news, market listings where appropriate, and other content supplied by the backend.

## Verification

Changes to this contract must keep these checks green:

- root TypeScript/Core check
- `tests/localization-runtime-tests.ts`
- mobile overlay materialization
- generated Expo mobile TypeScript check
- Expo public config resolution
- DB migration/preflight checks when locale persistence changes
