# Location Core v1 — 2026-09-16

## Rule

Palta must never collapse every location into one value.

Separate:
- device current location
- confirmed home area
- confirmed work area
- saved places
- exploring location

## Neighborhood resolution order

For the screen currently being viewed:

`exploring → current → home → work`

This does **not** mean exploring/current becomes a saved life fact.

## Promotion rule

Viewing or searching somewhere is not enough to promote it into the user's life context.

Only explicit/confirmed signals may create:
- home area
- work area
- saved place

## Permission

Foreground location is enough for the initial Neighborhood experience.

Background location is not part of the v1 requirement and must not be requested merely for personalization.
