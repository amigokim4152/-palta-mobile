# Palta Localization Runtime V1

## Mandatory developer directive

This document is a **cross-domain implementation contract**, not a feature note. Any branch that adds or changes user-visible UI, API display fields, search, notifications, messages, public data, business data, Community, Market, Care, Health, Transport, or future Palta modules must follow these rules.

Before implementing a new surface or data contract, read this document first. Do not create a feature-local language architecture that conflicts with it.

### Non-negotiable rules

1. **Language and region are independent.**
   - Display language may be `es-CL`, `ko`, `en`, or `zh-Hans`.
   - Chile context remains `region=CL`, `timezone=America/Santiago`, `currency=CLP` unless a domain explicitly defines another jurisdiction.
   - Never infer country, eligibility, currency, policy, or legal jurisdiction from UI language.

2. **Canonical data is language-neutral and stable.**
   - Routing, storage, analytics, filtering, permissions, events, Care state, and business logic use canonical IDs/keys/enums.
   - Translated text is presentation data, never the canonical identity of an entity or state.
   - Do not create one business, event, benefit, place, Care item, notification event, or Market policy object per language.

3. **No hard-coded user-facing copy in screens.**
   - Static UI copy must resolve through the shared localization catalogs.
   - Feature modules may add typed catalog keys, but may not create a second locale provider or independent locale persistence.
   - Avoid translated-fragment concatenation. Use named interpolation placeholders so word order can vary by language.

4. **Use `canonical key + localized label` for structured display metadata.**
   - Example: `category_key` + `category_label`, `entity_type` + `entity_type_label`, `opening_status` + `opening_status_label`.
   - Canonical keys must remain available even when localized labels are present.
   - A missing translation must never remove the underlying result.

5. **Preserve originals.**
   - Business names, venue names, organization names, event names, user posts, reviews, messages, and other proper/user-entered text remain in source form unless an explicit translation workflow exists.
   - Translated content must not overwrite the original.
   - When machine translation is introduced for dynamic content, the original must remain retrievable and the translation must be treated as a derived representation.

6. **Dynamic content translation belongs at the content boundary, not inside arbitrary UI components.**
   - UI chrome and known enum/taxonomy labels use local catalogs.
   - Server/editorial/public/UGC content uses structured translations or a shared translation service/cache when that domain supports it.
   - Do not scatter AI translation calls across screens.

7. **Search is multilingual by meaning, not only by literal text.**
   - A user may search in Korean, Spanish, English, or Chinese while the canonical Chile data is Spanish or language-neutral.
   - Search normalization/synonyms/semantic mapping must translate user intent into canonical search concepts without changing canonical records.
   - Do not maintain separate search indexes solely because the UI language differs unless the Search architecture explicitly requires it.

8. **Events and notifications are created once, localized when presented.**
   - One canonical event should drive Home, Care, notification, status, and follow-up flows.
   - Do not duplicate an event per language.
   - Notification title/body may be rendered or selected by the recipient locale at delivery/display time.

9. **Raw technical errors are never user copy.**
   - Keep diagnostic error details for logs/debugging.
   - User-facing error/loading/retry states must use shared localized copy.
   - Never expose raw `Error.message`, provider errors, SQL/API messages, or stack-related text directly in UI.

10. **Fallback is graceful and deterministic.**
    - Prefer the requested locale where a localized value exists.
    - Otherwise follow the domain contract and ultimately fall back to canonical/source text or `es-CL`.
    - Missing translation is not a reason for blank screens, dropped cards, or failed actions.

11. **Locale state is shared application state.**
    - Use the existing Localization Provider/runtime.
    - Account preference, pre-auth explicit choice, device locale, and fallback order defined below remain the single locale-resolution path.
    - New modules must consume this state; they must not own a competing locale state.

12. **New domains must extend this contract rather than bypass it.**
    - If a new domain needs translated fields, add them to that domain's canonical contract as additive presentation fields or translation objects.
    - Do not invent speculative duplicate domain models only for translation.
    - If a localization requirement cannot fit this model, update this document and shared localization runtime deliberately before shipping the exception.

13. **Canonical mutation/event payloads must not contain fabricated display prose.**
    - System-origin semantics belong in stable machine fields such as `source_context`, `intent_key`, `action_type`, or another typed canonical key.
    - A screen must not invent Spanish, Korean, English, or Chinese prose merely to satisfy a payload field.
    - User-authored text such as a quote description, message, review, or note stays in the exact language the user entered unless an explicit translation workflow creates a separate derived translation.
    - During migrations, readers may temporarily accept both the legacy prose-bearing payload and the new machine-key payload, but all newly written system-generated data must use the language-neutral form.
    - Machine keys may be stored, routed, retried, logged, and analyzed as canonical values; before they are shown to a user they must pass through the appropriate localized label resolver.

### Required implementation pattern for every new feature

When adding a new Palta feature or surface, apply this sequence:

`canonical domain model -> locale-aware presentation fields/resolver -> shared locale state -> localized UI -> fallback -> verification`

At minimum, check:

- Is every user-visible static string coming from a catalog/resolver?
- Are canonical IDs/keys/enums unchanged by language?
- Are region/timezone/currency independent from language?
- Are proper names and originals preserved?
- Are translated fields additive rather than destructive?
- Can the feature still render when a translation is missing?
- Are raw backend/provider errors hidden from users?
- Are system-generated mutation/event payloads language-neutral rather than fabricated prose?
- Are user-authored text fields preserved exactly unless a separate translation workflow is explicitly invoked?
- If search, message, notification, or dynamic content is involved, does it use the shared cross-domain localization boundary rather than a feature-local translation path?

### Definition of done for localization

A feature is not localization-complete merely because its buttons were translated. It is complete only when:

- all supported launch locales can enter the surface without broken navigation or missing required UI;
- canonical behavior is identical across languages;
- locale changes alter presentation, not jurisdiction or stored entity identity;
- source/original content is retained where required;
- system-generated canonical payloads contain machine semantics rather than localized display prose;
- fallback behavior is tested;
- relevant typecheck/tests/smoke checks pass;
- no new duplicate locale provider, locale store, translated canonical enum, or raw technical error exposure was introduced.

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
- `careCatalog.ts` — Care flow, timeline, intent and waiting labels
- `surfaceCatalog.ts` — secondary routes and shared async states
- `businessCatalog.ts` — typed business verification and capability labels

Runtime interpolation uses named placeholders such as `{count}`, `{status}`, or `{id}`. Do not concatenate translated fragments when word order can differ between languages.

## Canonical action and mutation payloads

System-generated workflow semantics must be represented by machine keys, not human-language filler text.

Example — quick quote launched from Business Detail:

```ts
{
  intent_key: 'local_business_quote',
  action_type: 'quote_request',
  payload: {
    source_context: 'business_detail'
  }
}
```

Do **not** manufacture a value such as `description: 'Solicitud iniciada desde el detalle del negocio.'` merely to record where the action began.

If the user actually enters a description, preserve it separately and exactly:

```ts
{
  payload: {
    description: '브레이크를 밟으면 소리가 납니다'
  }
}
```

Offline mutation queues and retry workers follow the same rule. Legacy queued records may be read for backward compatibility, but newly written machine-generated records must use canonical machine fields.

Care keys such as `local_business_quote` and `business_response`, and Business capability keys such as `queue` or `inquiry`, remain canonical internally and must resolve through localization before user display.

## Dynamic content

UI chrome and canonical enum labels are translated locally.

Server/user content must not be silently machine-translated in the UI layer. Use structured translations when the data contract provides them; otherwise show the canonical Spanish original. `contentResolver.ts` implements this fallback rule.

Home sends the selected locale to `/v1/home?locale=...`, allowing the server to return localized content where available.

Local search and business detail also receive the selected locale. Their public display contract is additive: canonical keys remain stable for routing, filtering, analytics, and storage, while localized fields are used only for presentation.

Current localized public-data fields include:

- `entity_type` + `entity_type_label`
- `category_key` + `category_label`
- `opening_status` + `opening_status_label`

This applies to the current local-search contract for `business`, `place`, `public_service`, and `event` entities. A missing localized field must not alter the canonical key and must not make the result disappear.

Proper names such as business names, venue names, event names, organization names, and user-entered text remain in their source form unless a domain later provides an explicit translated-name workflow.

Taxonomy labels, municipal/public content, events, news, and other data-driven content should continue to expose localized display fields or translation objects in their own data contracts rather than hard-coding translations into screens.

## Market contract

Market policy is language-neutral. `src/market/marketVerticalPolicy.ts` stores stable vertical keys and behavior only; it does not store Spanish or other display titles.

Market vertical display names resolve through `discoveryCatalog.ts` from the active Palta locale. Feature branches must not add `title`, `label`, or other language-specific presentation fields back into the canonical Market policy object.

## Mobile integration

Use `useLocalization()` from `mobile-overlay/src/providers/LocalizationProvider.tsx`.

For shared UI keys:

```ts
const { locale, t } = useLocalization();
const title = t('home.sectionTitle');
const more = t('home.showMore', { count: 3 });
```

For feature catalogs use the same `locale` with the feature resolver (`discoveryT`, `careT`, `surfaceT`, etc.). There must be one active locale state for the app.

Neighborhood search should prefer localized server metadata in this order where applicable:

1. `category_label`
2. `entity_type_label`
3. canonical fallback such as `category_key`

The canonical fields remain available even when a localized display field is present.

## Current connected surfaces

- authentication / sign-up
- bottom navigation
- language settings
- Home
- Neighborhood / map chrome and local-search result metadata
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
- Do not translate user-entered text or proper names in the UI layer without an explicit translation workflow.
- Do not duplicate the canonical business, place, Care, Market policy, or content object per language.
- Do not replace canonical taxonomy/status keys with translated text.
- Do not place fabricated human-language prose into machine-generated mutation/event payloads.
- Do not show raw `intent_key`, `waiting_for`, capability keys, or similar machine values when a localized presentation resolver exists.
- Do not use a missing translation as a reason to show an empty UI; fall back to the canonical/source value or Spanish original according to the data contract.

## Remaining data-contract work

The runtime localization foundation and the first public-data display contract are implemented. Remaining cross-domain work is intentionally domain-specific rather than another localization runtime:

- detailed municipal/public benefit and service content beyond current local-search metadata
- event detail content beyond current local-search metadata
- news/article content
- Market listing content where translated structured fields are appropriate
- future domain-specific taxonomies not yet represented by the current API contracts

Do not create speculative event/public-service detail models solely for localization. Add translated fields when those canonical domain contracts actually exist.

## Verification

Changes to this contract must keep these checks green:

- root TypeScript/Core check
- `tests/localization-runtime-tests.ts`
- `tests/localization-canonical-boundary-tests.ts`
- `npm run mock:verify` — starts the mock API and runs real HTTP localization smoke checks
- mobile overlay materialization
- generated Expo mobile TypeScript check
- Expo public config resolution
- DB migration/preflight checks when locale persistence changes

The canonical-boundary regression suite verifies that machine-generated quote actions do not fabricate localized prose, user-authored text remains unchanged, and Care/Business machine keys resolve to localized presentation labels.

The mock HTTP smoke currently verifies locale propagation and localized metadata for Home, local businesses, public services, events, business detail, proper-name preservation, and Care idempotency.
