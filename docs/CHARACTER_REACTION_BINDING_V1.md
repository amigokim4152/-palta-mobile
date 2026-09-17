# PALTA CHARACTER & REACTION BINDING v1

Status: ACTIVE IMPLEMENTATION CONTRACT
Branch: `integration/design-system-v1`

## Purpose

Bind the existing Google Drive Character & Living Example source of truth into the shared product UI without freezing unfinished artwork or allowing domains to invent their own mascot/reaction language.

## Upstream sources

- `PALTA Character & Living Example System v1 — Implementation Spec`
- `PALTA Character & Living Example Registry v1`
- `PALTA Experience Foundation v1`
- `PALTA_ICON_CHARACTER_LANGUAGE.md`

## Canonical character IDs

The product recognizes these six current official character identities:

- `CHAR_PAPA` — Palto Papá
- `CHAR_MAMA` — Palta Mamá
- `CHAR_HIJO` — Palti Hijo
- `CHAR_HIJA` — Paltita Hija
- `CHAR_ROCO` — Roco
- `CHAR_LUNA` — Luna

Their current upstream state is **PROVISIONAL / REFERENCE_IMAGES_AVAILABLE**. The names and semantic roles may be referenced by implementation. Final runtime illustration files are not frozen until the Character Asset source is promoted upstream.

## Runtime rule

`src/ui/characters.ts` owns the shared runtime identity contract.

Domains may request a character by semantic ID. They may not:

- redraw a Palta character locally
- create a domain-only Palta family member
- alter name/personality identity locally
- silently treat a reference image as a final production master
- create a parallel Character Registry

If the final runtime asset does not yet exist, the UI must fall back to a neutral structural treatment rather than inventing artwork.

## Sensitive-context suppression

Character-centered presentation is suppressed for:

- critical health/medical warnings
- disaster/emergency
- violence/crime
- death
- serious legal/tax loss
- debt/enforcement high-risk contexts

In these contexts direct, calm information UI has priority. The rule is encoded by `mayUseCharacterInContext()`.

## Synthetic/example rule

Palta character content is synthetic by definition when used as Living Example content.

Required properties:

- `synthetic=true`
- official Palta character identity
- small example/Palta-example disclosure
- exclusion from real-user analytics/ranking/recommendation learning
- no fake real contact/address/transaction state

## Reaction semantics

`src/ui/reactions.ts` defines the first shared reaction meaning set:

- `appreciate`
- `helpful`
- `celebrate`
- `curious`
- `concerned`
- `welcome`

These are meanings, not final artwork.

The final reaction asset may visually relate to the Character expression system, but a domain cannot replace a semantic reaction with arbitrary Unicode emoji or a separate third-party reaction pack.

## Community use

Community may use `ReactionBarContract` with registered `ReactionKey` values. Reaction semantics stay stable even if the visual asset evolves.

## Home / Empty-state use

Home and selected Empty States may use `CharacterPresentationContract` only when the content is useful and the context is not sensitive. Character presence is optional; a screen must never add a character merely to fill space.

## Social continuity

External social exports may reuse the same characters, expressions and scenarios, but social formatting does not create new product identities. The in-app registry remains the identity source.

## QA

Automated guardrails verify:

- all six canonical IDs are present
- the current provisional upstream status is preserved
- sensitive-context suppression exists
- shared reaction keys exist
- core/reaction defaults do not use Unicode emoji as product assets

Visual character/reaction asset quality remains NOT VERIFIED until official runtime assets are frozen and reviewed on-device.
