# MOBILE OVERLAY v1

Purpose: copy onto a fresh Expo Router SDK 57 app after GitHub integration is ready.

Status: NOT VERIFIED against installed Expo dependencies in this environment.

Why not marked PASS:
- Expo dependencies are not installed here.
- MapLibre React Native requires a custom development build.
- No iOS/Android native build has been executed yet.

This overlay intentionally contains:
- 5 primary tabs
- unified search route
- canonical place route
- activity/care route
- Home and Neighborhood feature entry points

It intentionally does NOT contain:
- fake map data
- fake authentication
- fake Supabase credentials
- design token guesses
- production provider secrets


## v2.2 route normalization

The overlay now matches `docs/APP_SHELL_ROUTE_CONTRACT.md`:
- `/business/[businessId]`
- `/care/[careTrackId]`
- `/context/[contextId]`
- `/search`
- `/map`

Legacy `/activity/[id]` redirects to the canonical Care route and should not be used for new code.
