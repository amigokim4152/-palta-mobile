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
7. Municipal benefits require locality + validity + verification before personalized admission.
8. Undated municipal claims stay out unless the canonical record explicitly says the service is ongoing.
9. Care `expected_at` means a process expectation, not an appointment; confirmed appointments/deadlines use `scheduled_at` and PRÓXIMO.
10. Home UI uses the shared Palta design system and adaptive accessibility behavior.

## Home surfaces

- **Glance**: ambient context only — weather, relevant ETA, operational state.
- **AHORA**: one highest-value action/alert.
- **EN CURSO**: active Care/waiting/process states.
- **PRÓXIMO**: confirmed future appointments, deadlines and events.
- **PARA HOY**: verified useful local information and sparse discovery.

## Integration matrix

| Source / Core | Home surface | Current state | Refresh / cache target | Failure rule | Next implementation action |
|---|---|---|---|---|---|
| Weather | Glance; exceptional change can become PARA HOY / alert | LIVE in development through Open-Meteo bridge | 15 min normal cache | Remove weather glance; report `unavailable`; never restore demo temperature as fallback | Replace fixed development coordinates with resolved user/location context in production service |
| Bus stop ETA | Glance; imminent relevant departure can become AHORA | Home adapter DONE; simulator ETA DEMO | Near relevant departure only; short refresh window | No ETA when realtime source is unavailable | Connect DTPM realtime credentials and saved/routine stop context when external access is available |
| Journey route planning | AHORA / PARA HOY when an actual trip is relevant | Existing Journey contract imported unchanged; Home bridge DONE | Recompute around a relevant planned trip | Route duration must never be labelled as bus-arrival ETA | Bind Journey client results after Journey integration branch is reconciled |
| Metro status | Glance; disruption can become AHORA | Adapter DONE; simulator value DEMO | Operational cache; faster during disruption | Hide status if freshness cannot be established | Bind verified Metro/DTPM operational source |
| Care / Event | AHORA or EN CURSO | Care Home adapter DONE; development Care track visible | Event-driven plus cached Home projection | Do not invent completion/result; closed outcomes leave active Home | Bind production Care/Event persistence/event bus to adapter |
| Confirmed schedules | PRÓXIMO; can promote to AHORA inside attention window | Generic scheduled-event adapter DONE; one explicit visual DEMO item | Event/calendar driven | Unconfirmed associations/events are excluded | Bind verified school/calendar/health/vehicle schedule sources one by one |
| Municipal benefits / services | PARA HOY; deadline can become AHORA | Official Vitacura benefits source connected in development; verification adapter DONE | 20 min dev bridge; production low-frequency scheduled refresh | Official-source failure -> `unavailable`; no demo replacement | Normalize individual Vitacura programs with dates/ongoing status, then expand municipal registry comuna by comuna |
| Local municipal news | PARA HOY / discovery only | Official Vitacura news source connected in development | 20 min source cache; articles filtered to recent window | Source failure -> `unavailable`; no filler | Move HTML bridge into production ingestion/cache and expand source registry beyond Vitacura |
| School | PRÓXIMO / AHORA / PARA HOY | Schedule adapter READY; visible PRÓXIMO is explicitly DEMO | Event/calendar driven | No guessed child/school association | Bind verified school/class relationship, deadlines and preparation events |
| Community | EN CURSO / PARA HOY | Core work exists separately; not Home-connected yet | Event driven; quiet by default | No engagement filler | Emit only relevant joined-community actions/events through Home adapter |
| Commerce / POS | EN CURSO / AHORA | Core work exists separately; not Home-connected yet | Event driven | User sees only authorized transaction/order state | Add payment/order candidate projection after Commerce contract reconciliation |
| Delivery | EN CURSO / AHORA | Planned ecosystem path; not Home-connected yet | Event driven | Last confirmed carrier state must carry freshness | Define delivery event adapter shared by Business and Personal Home |
| Health | AHORA / EN CURSO / PRÓXIMO | Care + schedule primitives READY; health source not connected | Event/lifecycle driven | Never infer diagnosis; confirmed user care state only | Bind appointment/preparation/follow-up through Care/Event Core |
| Vehicle | AHORA / PRÓXIMO | Schedule primitive READY; verified vehicle source not connected | Lifecycle/date driven | No guessed vehicle ownership | Bind verified vehicle asset and inspection/maintenance lifecycle |
| Pets | PRÓXIMO / PARA HOY | Schedule primitive READY; pet source not connected | Lifecycle/date driven | No guessed pet ownership | Bind verified pet profile and legal/care lifecycle events |
| Air quality | Glance only when locally meaningful | NOT CONNECTED; no placeholder required | Moderate cache | Omit when unavailable | Select verified Chile source before implementation |
| FX | Optional Glance only when user context makes it useful | NOT DEFAULT | Moderate cache | Omit | Do not add as permanent Home slot |

## Visible rollout order

1. Runtime Home visual grammar — DONE
2. Source-state contract (`live/cached/scheduled/demo/unavailable`) — DONE
3. Domain merge/admission contract — DONE
4. Weather development live path — DONE
5. Mobility adapter + no-fake-ETA rule — DONE
6. Journey contract reuse + Home bridge — DONE
7. PRÓXIMO scheduled-event primitive — DONE
8. Care lifecycle projection primitive — DONE
9. Official Vitacura benefits development source — DONE
10. Official Vitacura municipal-news development source — DONE
11. DTPM stop realtime binding — PENDING EXTERNAL ACCESS
12. Production Care/Event persistence binding — NEXT CORE BINDING
13. Individual municipal-program normalization + multi-comuna registry — NEXT DATA PIPELINE
14. Local-news production ingestion + multi-comuna source registry — NEXT DATA PIPELINE
15. School/Community/Commerce/Delivery domain binding — FOLLOWING DOMAIN INTEGRATION

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
