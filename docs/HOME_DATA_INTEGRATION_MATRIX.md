# Home Data Integration Matrix

Status: ACTIVE IMPLEMENTATION TRACKER
Branch: `integration/home-runtime-v1`

This file is the working checklist for making every Palta core visible through Home without turning Home into a module dashboard.

## Non-negotiable rules

1. A domain contributes data through a Home adapter; it does not own permanent Home layout.
2. Every source reports one of: `live`, `cached`, `scheduled`, `demo`, `unavailable`.
3. Missing realtime data is never replaced by a fabricated ETA, status or weather value.
4. Expired data is excluded unless the UI explicitly presents it as stale historical context.
5. Personal/action cards outrank discovery content.
6. News never exists merely to make Home look full.
7. Municipal benefits require locality + validity + verification before Home admission.
8. Home UI uses the shared Palta design system and adaptive accessibility behavior.

## Integration matrix

| Source / Core | Home surface | Current state | Refresh / cache target | Failure rule | Next implementation action |
|---|---|---|---|---|---|
| Weather | Glance; exceptional change can become PARA HOY / alert | LIVE in development through Open-Meteo bridge | 15 min normal cache; shorter only for exceptional conditions if needed | Remove weather glance; report `unavailable`; never restore demo temperature as fallback | Replace development coordinates with resolved user/location context in production service |
| Bus ETA | Glance; imminent relevant departure can become AHORA | Adapter DONE; simulator value DEMO | Near relevant departure only; short cache/refresh window | No ETA when realtime source is unavailable | Connect DTPM realtime credentials when available and bind saved/routine stop context |
| Metro status | Glance; disruption can become AHORA | Adapter DONE; simulator value DEMO | Operational status cache; refresh faster during disruption | Hide status if freshness cannot be established | Bind verified Metro/DTPM operational source |
| Care / Event | AHORA or EN CURSO | Visible with development Care track; core lifecycle already exists | Event-driven plus cached Home projection | Keep last confirmed state with freshness; do not invent completion | Bind production Care/Event persistence to Home candidate projection |
| Municipal benefits / services | PARA HOY; deadline can become AHORA | Filtering adapter DONE; visible content still DEMO | Low-frequency scheduled refresh plus source verification | Exclude stale, conflict, rejected and needs-verification records | Connect normalized municipal/public-data registry and canonical record IDs |
| Local news | PARA HOY / discovery only | Filtering adapter DONE; visible content still DEMO | Scheduled ingestion; current adapter defaults to 48h freshness window | No filler when feed is unavailable or weak | Connect local-news ingestion, summary, canonical source link and locality relevance |
| School | AHORA / EN CURSO / PARA HOY | Contract slot exists; not runtime-connected | Event/calendar driven | No guessed child/school association | Bind verified school/class relationship and preparation/deadline events |
| Community | EN CURSO / PARA HOY | Core work exists separately; not Home-connected | Event driven; quiet by default | No engagement filler | Emit only relevant joined-community events/actions through Home adapter |
| Commerce / POS | EN CURSO / AHORA | Core work exists separately; not Home-connected | Event driven | User sees only transactions/actions they are authorized to see | Add payment/order/delivery candidate projection after Commerce contract stabilizes |
| Delivery | EN CURSO / AHORA | Planned ecosystem path; not Home-connected | Event driven | External carrier failure keeps last confirmed state with explicit freshness | Define delivery event adapter shared by Business and Personal Home |
| Health | AHORA / EN CURSO / PARA HOY | Domain planned; not Home-connected | Event/lifecycle driven | Never infer diagnosis; surface confirmed user care state only | Bind appointment/preparation/follow-up events through Care/Event Core |
| Vehicle | AHORA / PRÓXIMO | Domain references exist | Lifecycle/date driven | No guessed vehicle ownership | Bind verified vehicle asset and inspection/maintenance lifecycle |
| Pets | PRÓXIMO / PARA HOY | Planned | Lifecycle/date driven | No guessed pet ownership | Bind verified pet profile and legal/care lifecycle events |
| Air quality | Glance only when locally meaningful | NOT CONNECTED; no current placeholder required | Moderate cache | Omit when unavailable | Select verified Chile source before implementation |
| FX | Optional Glance only when user context makes it useful | NOT DEFAULT | Moderate cache | Omit | Do not add as permanent Home slot |

## Visible rollout order

1. Runtime Home visual grammar — DONE
2. Source-state contract (`live/cached/scheduled/demo/unavailable`) — DONE
3. Domain merge/admission contract — DONE
4. Weather development live path — DONE
5. Mobility adapter + no-fake-ETA rule — DONE
6. DTPM realtime binding — PENDING EXTERNAL ACCESS
7. Municipal normalized-data binding — NEXT DATA PIPELINE
8. Local-news ingestion binding — NEXT DATA PIPELINE
9. Care/Event production projection — NEXT CORE BINDING
10. School/Community/Commerce/Delivery adapters — FOLLOWING DOMAIN INTEGRATION

## Definition of done for any future domain

A domain is not considered Home-integrated until all of these are true:

- canonical source/data contract exists
- source mode and freshness are explicit
- Home adapter exists
- dedupe/admission behavior is tested
- Home placement is defined
- empty/unavailable behavior is defined
- simulator/runtime path visibly renders it
- accessibility layout is preserved
- action/deep link works when an action is shown
- CI/typecheck/tests pass

The result must be inspectable on screen, not merely implemented as an isolated core.
