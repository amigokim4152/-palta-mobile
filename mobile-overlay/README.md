# Palta Mobile Overlay

Purpose: mobile UI/runtime layer for the Palta Expo application while keeping product/domain cores provider-neutral and reusable.

Status: native runtime verification is separate from core/CI verification. MapLibre React Native requires a custom development build; Expo Go is not a valid verification environment for MapLibre native behavior.

This overlay contains:
- 5 primary tabs
- unified search route
- canonical place route
- Care/activity route
- Home and Neighborhood feature entry points
- Expo/native adapter boundaries

It intentionally does NOT contain:
- fake map data
- fake authentication
- fake Supabase credentials
- production provider secrets
- provider-specific logic inside product-domain cores

## Canonical mobile identity

```text
name: Palta
slug: palta
scheme: palta
iOS bundle identifier: cl.somospalta.app
Android application ID: cl.somospalta.app
```

## Route normalization

The overlay follows `docs/APP_SHELL_ROUTE_CONTRACT.md`:
- `/business/[businessId]`
- `/care/[careTrackId]`
- `/context/[contextId]`
- `/search`
- `/map`

Legacy `/activity/[id]` redirects to the canonical Care route and should not be used for new code.
