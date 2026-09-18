# Home Runtime Integration v1

Status: ACTIVE — RUNTIME SHELL DONE / DATA SOURCES INTEGRATING
Branch: `integration/home-runtime-v1`
Base lineage: simulator recovery + Palta design system contracts

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

## Source-state rule

Every Home source now declares one of:

- `live`
- `cached`
- `scheduled`
- `demo`
- `unavailable`

A missing realtime source must not silently fall back to a fabricated realtime value. Development sample data is explicitly marked `demo`. Expired contributions are rejected by the source merge layer.

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
Care/Event Core ------> source adapters -> freshness/admission -> Home composition -> /v1/home -> Home UI
Municipal Core ------/
News Core -----------/
Community Core ------/
Commerce Core -------/
```

## Current implementation status

### Phase 1 — Runtime shell — DONE

- reference Home visual grammar is bound to the real `GET /v1/home` runtime path
- adaptive/accessibility behavior preserved
- locality and glance contract added
- current Care status can render as the primary visible surface
- development data is explicitly marked as sample data
- safe bounded simulator sync path exists

### Phase 2 — Source contracts — DONE

- source-state metadata added
- domain source adapter contract added
- source merger rejects expired/unavailable contributions
- weather, mobility, municipal and news adapters added
- automated tests cover no-fake-ETA, stale weather exclusion, municipal verification and news freshness/locality

### Phase 3 — Weather — DEVELOPMENT LIVE

- Open-Meteo development bridge added
- normal weather cached for 15 minutes
- no fake weather fallback
- failure becomes `weather: unavailable`
- production location-context binding remains pending

### Phase 4 — Mobility — ADAPTER READY / REALTIME PENDING

- relevant bus ETA and Metro status contract exists
- imminent relevant departure can promote to AHORA
- disruption can promote to alert
- simulator mobility values remain explicitly `demo`
- real DTPM binding waits for external realtime access

### Phase 5 — Municipal benefits — FILTER READY / DATA PIPELINE PENDING

- verified/corroborated records only
- locality + eligibility + validity required
- stale/conflict/needs-verification/rejected records excluded
- deadline can promote to action

### Phase 6 — News/local information — FILTER READY / INGESTION PENDING

- locality relevance required
- freshness window enforced
- discovery remains subordinate to personal/action cards
- canonical source/deep-link ingestion remains pending

## Development mock rule

The development API may contain realistic sample content solely to make layout and interaction inspectable in the simulator. Every sample source must declare `data_mode: demo`. A sample value must never be presented as realtime data.

Weather is the first exception: the development Home attempts a live Open-Meteo fetch. If it fails, weather is omitted and reported unavailable rather than replaced with demo weather.

## Simulator

Use `scripts/run-home-runtime-safe.sh` to sync only the bounded Home runtime files into the existing local Expo app, restart a stale Palta development API safely, then invoke the existing simulator recovery launcher. It does not switch the current git branch and does not merge `main`.

See `docs/HOME_DATA_INTEGRATION_MATRIX.md` for the ongoing source-by-source rollout and definition of done.
