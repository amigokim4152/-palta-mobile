# Home Runtime Integration v1

Status: INTEGRATION IN PROGRESS
Branch: `integration/home-runtime-v1`
Base: `integration/simulator-runtime-fix-v1`

## Goal

Make Palta Home the visible composition surface for already-built and future domain cores.
A domain must not render its own permanent widget directly into Home. It contributes either:

1. compact ambient context to `glance`, or
2. a ranked Home candidate to the existing Home composition pipeline.

Home remains a life inbox, not a portal or module dashboard.

## Visual grammar

Use the existing Palta UI system:

- `GlanceCluster` for compact ambient context
- `ActionSurface` for the single highest-value current action/status
- `SummaryListRow` for ongoing and useful-today items
- semantic tokens from `paltaTheme`
- scalable text and adaptive layouts
- no target card count
- no dead controls
- no low-value filler

The official Brand Master remains canonical for brand assets. Runtime code must not redraw the logo or freeze new brand colors independently.

## Home zones

### Glance

Small, ambient, immediately useful context. Typical sources:

- weather
- nearby/relevant bus ETA
- Metro operational state
- air quality when relevant

Glance is not a permanent four-slot dashboard. Items are selected by context and relevance.

### AHORA

Only the highest-value action or alert requiring attention now.

### EN CURSO

Waiting states, requests, reservations, quotes, payments, deliveries and Care/Event lifecycle states.

### PARA HOY

Useful local information for the current day: municipal benefits, operational changes, school/community items and contextual content.

### Discovery/news

News and discovery content are admitted only when Home is sparse. The existing density policy remains authoritative.

## Adapter rule

Each domain owns its source adapter and emits a Home-compatible contract. It does not own Home layout.

```text
Weather Core -------\
Mobility Core -------\
Care/Event Core ------> Home candidate/adapters -> ranking/dedupe -> /v1/home -> Home UI
Municipal Core ------/
News Core -----------/
Community Core ------/
Commerce Core -------/
```

## Visible implementation sequence

### Phase 1 — Runtime shell

- bind the reference Home visual grammar to the real `GET /v1/home` runtime path
- preserve adaptive/accessibility behavior
- add locality and glance contract
- show current Care status as the primary visible surface
- show development placeholders for municipal benefits and local news
- provide a safe simulator sync path

### Phase 2 — Weather

- replace development weather glance with a Weather Adapter
- cache normal weather data
- promote only meaningful changes to Home cards/notifications
- examples: rain before a relevant trip, major temperature change, severe conditions

### Phase 3 — Mobility

- connect Metro state and relevant bus ETA
- do not stream every nearby vehicle into Home
- use time/place/routine relevance before admitting transit to glance
- promote disruptions or imminent departures when action is useful

### Phase 4 — Municipal benefits

- connect verified comuna/service data
- only emit benefits/services matching locality, eligibility context and validity window
- carry verification/freshness metadata
- no expired or undated benefit should be treated as current without verification

### Phase 5 — News/local information

- connect local/news pipeline
- summary first, source attribution and deep link on detail surface
- discovery density remains subordinate to personal/action cards

## Development mock rule

The mock API may contain realistic sample content solely to make layout and interaction inspectable in the simulator. Sample values are not production claims and must be replaced by adapters before release.

## Simulator

Use `scripts/run-home-runtime-safe.sh` to sync only the bounded Home runtime files into the existing local Expo app, restart a stale Palta mock API safely, then invoke the existing simulator recovery launcher. It does not switch the current git branch and does not merge `main`.
