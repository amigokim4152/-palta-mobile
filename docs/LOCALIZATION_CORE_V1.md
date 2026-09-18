# Palta Localization Core v1

## Product rule

Palta is a Chile-first product. The canonical/default language is Chilean Spanish (`es-CL`).

Supported UI locales in v1:

- `es-CL` — canonical/default
- `ko` — Korean
- `en` — English
- `zh-Hans` — Simplified Chinese

The rendering rule is intentionally simple:

1. If content/UI copy exists in the user's preferred locale, show it.
2. If it does not exist, show the Spanish source/canonical copy.
3. Never fabricate an empty state only because a translation is missing.
4. Never use English as an intermediate fallback.

## Language is not region

Changing the UI language must not change Chile context.

- region: `CL`
- timezone: `America/Santiago`
- currency: `CLP`

A Korean user in Santiago should see Korean UI where available while continuing to receive Chilean businesses, municipal data, transport, prices, dates, and local context.

## Preference precedence

`resolvePreferredLocale()` applies this order:

1. saved account preference
2. supported device locale
3. `es-CL`

The device locale is only an onboarding/default hint. Once a user chooses a language, the account preference wins across devices.

## UI copy

Do not hard-code visible product copy in feature modules when a shared localization key is appropriate.

Use:

```ts
import { t } from '../localization/index.js';

const label = t('common.save', preferredLocale);
```

Spanish catalog entries are complete canonical values. Korean, English, and Simplified Chinese catalogs may be partial; missing keys fall back to Spanish.

## Dynamic/content copy

Do not overwrite original content when a translation is added.

Canonical shape:

```ts
{
  original: 'Hoy cerramos a las 18:00.',
  sourceLocale: 'es-CL',
  translations: {
    ko: { text: '오늘은 오후 6시에 문을 닫습니다.', status: 'reviewed' },
    'zh-Hans': { text: '今天18:00关门。', status: 'machine' }
  }
}
```

Use `resolveLocalizedContent()` to render it.

Translation status is preserved so future surfaces can distinguish machine/reviewed/approved content where needed.

## Proper names and identifiers

Do not automatically translate identifiers that users need to recognize in the real world:

- business names
- person names
- addresses
- official entity names when translation would make identification ambiguous
- IDs, route numbers, legal identifiers

Descriptions, instructions, UI controls, explanatory copy, and managed content may be translated.

## Profile integration contract

The auth/profile workstream should persist a supported locale value such as:

```text
preferred_locale = ko
```

It should consume the localization module's `PaltaLocale` / `resolvePreferredLocale()` contract rather than creating a separate locale enum or fallback policy.

## Content storage direction

For database-backed Palta-managed content, keep the Spanish source separate from translations. A future normalized translation table should minimally retain:

- source/content ID
- locale
- translated text
- translation status/source
- updated timestamp

Do not generate four duplicate canonical business/event/content records solely for language variants.

## Runtime invariants

The v1 test suite enforces:

- Spanish is canonical default.
- supported device locales normalize correctly.
- saved account preference wins over device locale.
- missing translations fall back to Spanish.
- changing language does not change `CL`, `America/Santiago`, or `CLP`.
- translated content preserves provenance/status metadata.

## Integration rule for feature branches

Negocios, Community, Transport, Health, Home, Messaging, Commerce/POS, and future surfaces should import this shared localization contract. Feature-specific fallback chains must not be introduced.
