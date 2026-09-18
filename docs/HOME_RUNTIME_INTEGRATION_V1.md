# Home Runtime Integration v1

Status: ACTIVE — VISIBLE RUNTIME INTEGRATION
Branch: `integration/home-runtime-v1`
Base lineage: simulator recovery + Palta design system contracts

## Goal

Make Palta Home the visible composition surface for already-built and future domain cores.
A domain must not render its own permanent widget directly into Home. It contributes either:

1. compact ambient context to `glance`, or
2. a ranked Home item through an adapter.

Home remains a life inbox, not a portal or module dashboard.

## Visual grammar

Use the existing Palta UI system:

- `GlanceCluster` for compact ambient context
- `ActionSurface` for the single highest-value current action/status
- `SummaryListRow` for ongoing, upcoming and useful-today items
- semantic tokens from `paltaTheme`
- scalable text and adaptive layouts
- no target card count
- no dead controls
- no low-value filler

The official Brand Master remains canonical for brand assets. Runtime code must not redraw the logo or freeze new brand colors independently.

## Source-state rule

Every Home source declares one of:

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
- nearby/relevant bus stop ETA
- Metro operational state
- air quality when relevant

Glance is not a permanent four-slot dashboard. Items are selected by context and relevance.

### AHORA

Only the highest-value action or alert requiring attention now.

### EN CURSO

Waiting states, requests, quotes, payments, deliveries and active Care/Event lifecycle states.

`Care.expected_at` remains process context here. It does not become an appointment automatically.

### PRÓXIMO

Confirmed future appointments, deadlines and scheduled events. These use `scheduled_at` and never guessed relationships.

A required action may promote from PRÓXIMO to AHORA when it enters its configured attention window.

### PARA HOY

Useful local information for the current day: municipal services/benefits, operational changes and relevant contextual content.

### Discovery/news

News and discovery content are admitted only when Home is sparse. The existing density policy remains authoritative.

## Adapter rule

Each domain owns its source adapter and emits a Home-compatible contract. It does not own Home layout.

```text
Weather Core ---------\
Stop Realtime ---------\
Journey Core -----------\
Care/Event Core ---------> source adapters -> freshness/admission -> Home composition -> /v1/home -> Home UI
Schedules --------------/
Municipal Core ---------/
News Core --------------/
Community Core ---------/
Commerce Core ----------/
```

## Transport separation

The existing Journey contract is reused unchanged for route planning. It already represents transit legs (`bus`, `metro`, `rail`), route names, providers and whether an option used realtime data.

Journey duration and stop-arrival ETA are different products:

- Journey can say a relevant trip takes approximately N minutes.
- Only a stop realtime source can say a bus arrives in N minutes.

The Home bridge explicitly keeps these separate. DTPM stop ETA remains pending external realtime access.

## Current implementation status

### Phase 1 — Runtime shell — DONE

- reference Home visual grammar bound to real `GET /v1/home`
- adaptive/accessibility behavior preserved
- locality and glance contract added
- external/internal action targets supported
- safe bounded simulator sync path exists

### Phase 2 — Source contracts — DONE

- source-state metadata added
- domain source adapter contract added
- source merger rejects expired/unavailable contributions
- weather, mobility, Journey, Care, scheduled-event, municipal and news adapters/bridges added
- automated tests cover no-fake-ETA, stale exclusion, municipal validity, source actions and schedule/Care separation

### Phase 3 — Weather — DEVELOPMENT LIVE

- Open-Meteo development bridge added
- normal weather cached for 15 minutes
- no fake weather fallback
- failure becomes `weather: unavailable`
- production location-context binding remains pending

### Phase 4 — Mobility — CONTRACTS READY / STOP REALTIME PENDING

- relevant bus ETA and Metro status contract exists
- imminent relevant departure can promote to AHORA
- disruption can promote to alert
- existing Journey contract is reused without redefining its types
- Journey route duration is never used as stop ETA
- simulator bus/Metro values remain explicitly `demo`
- real DTPM stop binding waits for external realtime access

### Phase 5 — Care + PRÓXIMO — PRIMITIVES DONE

- Care wait/result/follow-up states map to Home
- closed/cancelled Care leaves active Home
- `expected_at` stays EN CURSO context
- confirmed scheduled events use `scheduled_at` and render under PRÓXIMO
- unconfirmed schedule relationships are excluded
- one explicit PRÓXIMO demo item exists only for visual simulator QA

### Phase 6 — Municipal benefits — OFFICIAL VITACURA DEVELOPMENT SOURCE CONNECTED

- official Vitacura benefits page is fetched through the development bridge
- source success is `scheduled`; failure is `unavailable`
- no municipal demo fallback
- canonical source action opens the official page
- personalized program admission still requires normalized date/ongoing/eligibility records
- broader comuna registry remains pending

### Phase 7 — Local municipal news — OFFICIAL VITACURA DEVELOPMENT SOURCE CONNECTED

- official Vitacura news listing/articles are used in development
- source success is `scheduled`; failure is `unavailable`
- recent-window filtering is enforced
- canonical source actions open the official article
- no filler fallback
- production ingestion/cache and multi-comuna source registry remain pending

## Development sample rule

The development API may contain realistic sample content solely to make layout and interaction inspectable in the simulator. Every sample source must declare `data_mode: demo`. A sample value must never be presented as realtime data.

At the current stage:

- weather: live or unavailable
- Vitacura municipal benefits: scheduled official source or unavailable
- Vitacura municipal news: scheduled official source or unavailable
- bus/Metro: demo until realtime access is connected
- Care: demo track for interaction QA
- one scheduled item: demo for PRÓXIMO layout QA

## Simulator

Use `scripts/run-home-runtime-safe.sh` to sync only the bounded Home runtime files into the existing local Expo app, restart a stale Palta development API safely, then invoke the existing simulator recovery launcher. It does not switch the current git branch and does not merge `main`.

See `docs/HOME_DATA_INTEGRATION_MATRIX.md` for the ongoing source-by-source rollout and definition of done.
