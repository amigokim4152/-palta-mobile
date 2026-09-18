# Home Complete Demo → Live Data Replacement Plan

Status: ACTIVE
Branch: `integration/home-functional-foundation-v1`

## Purpose

The development Home must look and behave like a complete product before every live source exists.

This is intentional:

1. Build the complete information architecture with explicitly marked `demo` data.
2. Validate what belongs on Home and how the user understands it.
3. Freeze the functional placement rules.
4. Replace each demo provider with its canonical live/cached/scheduled source without redesigning Home.

`demo` data must never be presented as live data. Final visual styling is not part of this phase.

## Complete demo baseline

### Context
- effective locality
- notification inbox + unread count
- profile entry

### Glance
| Demo signal | Intended canonical source |
|---|---|
| Weather | Weather provider / Weather Core |
| Metro status | Mobility Core operational status |
| Frequent bus ETA | DTPM realtime ETA source |
| Air quality | verified public/environmental source |
| Local safety/emergency state | verified Safety/Event source |

### AHORA
| Demo item | Intended canonical source |
|---|---|
| Frequent bus arriving soon | verified realtime Mobility ETA |
| School document due today | School relationship + confirmed deadline/event source |
| Payment required | CommerceOrder + Payment state |
| Quote response requiring decision | Local Business + Care/Event |
| Important direct message | Message Core |
| Emergency/safety alert | verified Safety/Event Core |
| Administrative deadline due soon | Public-Life + lifecycle/deadline source |

### EN CURSO
| Demo item | Intended canonical source |
|---|---|
| Workshop quote/request waiting | Care/Event Core |
| Order preparing | CommerceOrder |
| Municipal application under review | Municipal/Public-Life workflow state |
| Community membership pending | Community canonical membership state |
| Job application in review | Jobs Core |
| Property inquiry waiting for response | Real Estate Core |
| Physical shipment in transit | Logistics Core; never CustomerDelivery messaging state |
| Refund processing | Commerce/Payment Core |

### PRÓXIMO
| Demo item | Intended canonical source |
|---|---|
| Medical appointment | Health Core + confirmed schedule |
| School activity | School relationship + confirmed schedule |
| Community event | Community event/calendar source |
| Vehicle inspection | Vehicle lifecycle Core + confirmed schedule |
| Pet vaccination | Pets lifecycle Core + confirmed schedule |
| Job interview | Jobs Core + confirmed schedule |
| Property viewing | Real Estate Core + confirmed schedule |
| Reservation/appointment | Care/Event + confirmed schedule |
| Administrative renewal | Public-Life + lifecycle/deadline source |

### PARA HOY
| Demo item | Intended canonical source |
|---|---|
| Relevant municipal benefit | Municipal Data Engine + eligibility/relevance |
| Important school/community notice | Community/School announcement source |
| Local news | News Engine + locality/recency/relevance |
| Seasonal fruit | Food/Seasonality canonical dataset |
| Seasonal vegetables | Food/Seasonality canonical dataset |
| Seasonal fish/seafood | Food/Seasonality canonical dataset |
| Nearby weekend panorama | Events/Culture/Panoramas source |
| Followed-business meaningful update | Local Business follow/subscription state |
| Local service/operational change | Municipal/Public-Life source |
| Highly relevant nearby job | Jobs relevance engine |
| Meaningful saved-property change | Real Estate saved-item state |

## Seasonal food migration boundary

Home must not read migrated Base44 food tables or files directly.

The migration/food side owns the factual seasonality dataset. Home receives a normalized `SeasonalFoodSnapshot` through `src/home/adapters/seasonalFoodFunctionalAdapter.ts` with only:

- `category`: `fruit | vegetable | seafood`
- `regionKey`
- `periodKey`
- `items[]` with canonical item id and display name
- `dataMode`
- `observedAt`
- optional `expiresAt`
- optional detail `actionTarget`

The adapter maps those snapshots to the stable Home slots:

- `today.seasonal_fruit`
- `today.seasonal_vegetable`
- `today.seasonal_seafood`

The development Home already shows these three cards. When canonical migrated data is ready, the demo provider is removed only after the adapter receives the real snapshots and passes the replacement gates below. No Home redesign is required.

## Home behavior baseline

The complete Home also keeps these cross-cutting functions independent of final design:

- context resolution without silently turning GPS into a home fact
- person/household/vehicle/pet/business/place subject scope
- personalized correction feedback
- exact deep links and no fake action buttons
- source freshness and explicit `live/cached/scheduled/demo/unavailable`
- no fabricated realtime fallback values
- dedupe and cross-domain priority
- confirmed completion before removing a real process
- notification escalation rules
- notification inbox/read-count synchronization
- cached startup and stale realtime filtering
- offline mutation queue when runtime support is available
- valid quiet state with no filler
- refresh after returning from detail/action surfaces
- explicit separation between demo and live data

## Replacement order

Replace only one source class at a time and keep the rest of the complete demo baseline visible.

1. Weather
2. Municipal benefits/services and local operational changes
3. Local news
4. Metro operational status
5. DTPM bus ETA
6. Care/Event state and reservations
7. CommerceOrder + Payment/refund state
8. Local Business quote/followed-business updates
9. Community membership/announcements/events
10. School relationships/events/deadlines
11. Message Core important-message projection
12. Jobs applications/interviews/relevance
13. Real Estate inquiries/viewings/saved-property changes
14. Logistics physical shipment state
15. Safety/Event emergency source
16. Health confirmed schedules and follow-up
17. Vehicle lifecycle
18. Pets lifecycle
19. Seasonal fruit / vegetables / fish-seafood canonical data
20. Culture/events/Panoramas

## Replacement rule

A demo item may be removed only when its replacement passes all of these gates:

- canonical source identified
- source freshness/validity defined
- no fabricated fallback value
- Home admission/relevance rule implemented
- exact action/deep link implemented where applicable
- personalized correction path retained where applicable
- unavailable behavior defined
- automated tests pass
- simulator confirms the live replacement in the same semantic Home position

## UI rule

Final visual styling is not frozen by this document. The semantic Home structure is:

`Context → Glance → AHORA → EN CURSO → PRÓXIMO → PARA HOY`

The number of visible rows is dynamic in production. The complete demo deliberately shows more categories than one real user would normally see at once so that product gaps can be found before live-data integration.
