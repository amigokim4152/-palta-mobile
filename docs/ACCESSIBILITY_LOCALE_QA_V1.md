# PALTA ACCESSIBILITY & LOCALE QA v1

Status: ACTIVE QA CONTRACT
Branch: `integration/design-system-v1`

## Purpose

Prevent a visually coherent Palta UI from failing on real phones because of long Spanish copy, Korean copy, text scaling, keyboard/safe-area issues, screen-reader gaps or state feedback that relies only on color.

## Locale baseline

Initial official UI locales:

- `es-CL`
- `ko`

Official UI fallback remains:

`selected locale -> es-CL -> source`

User-generated content keeps its original content and is not forcibly replaced by a translated version.

## Required locale stress targets

`src/ui/localeQa.ts` contains shared stress strings for:

- buttons
- bottom-sheet titles
- status labels
- empty states

Rules:

- do not rely on fixed text heights
- wrap where the component contract permits wrapping
- never truncate the semantic meaning of a primary action or critical state
- test both normal and enlarged text
- business/POS numeric layouts must remain legible independently from prose typography

## Required accessibility checks

`src/ui/accessibilityQa.ts` defines these required checks:

1. touch target
2. dynamic text
3. contrast
4. screen-reader label
5. focus order
6. reduced motion
7. state not communicated by color alone
8. keyboard visibility
9. safe area
10. back-state restoration

A feature is not accessibility-complete when any required check remains `NOT VERIFIED`.

## Platform adapter boundary

`src/ui/platformAdapter.ts` defines a renderer-independent contract for iOS, Android and Web.

This is intentional: the repository does not yet contain the final Expo/React Native runtime shell. Shared UI semantics therefore stay framework-neutral until the native adapter exists.

The eventual native adapter must report/support:

- haptic capability
- native back gesture behavior
- safe area
- Reduce Motion preference
- Dynamic Text/font scaling

## Required native validation matrix

At minimum, representative flows must be reviewed under:

- es-CL / normal text / normal motion
- es-CL / enlarged text / reduced motion
- ko / normal text / normal motion
- ko / enlarged text / reduced motion / offline state

Evidence may include screenshots, screen-reader checks, interaction recordings, performance traces and device notes.

## Cross-domain synthetic QA personas

`src/ui/qaPersonas.ts` binds the five current Foundation QA personas:

- QA-01 Vitacura — parent/business owner
- QA-02 Providencia — commuter/parent
- QA-03 Macul — student/family member
- QA-04 Santiago Centro — single renter
- QA-05 La Florida / Puente Alto — family/long commute

These are synthetic QA identities only. They are not real-user profile data.

## Gate policy

A design screen can be marked structural PASS before native runtime exists only for hierarchy/contract consistency.

The following remain `NOT VERIFIED` until real-device adapter testing:

- final tap comfort
- keyboard behavior
- safe-area behavior
- screen-reader order and labels
- Reduce Motion behavior
- actual color contrast after brand color freeze
- frame stability
- platform haptic behavior

Do not convert NOT VERIFIED to PASS from static HTML screenshots alone.
