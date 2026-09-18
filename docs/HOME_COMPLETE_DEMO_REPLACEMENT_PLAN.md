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

`demo` data must never be presented as live data. The UI shows one clear development marker instead of repeating DEMO on every row.

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

### AHORA
| Demo item | Intended canonical source |
|---|---|
| Frequent bus arriving soon | verified realtime Mobility ETA |
| School document due today | School relationship + confirmed deadline/event source |

### EN CURSO
| Demo item | Intended canonical source |
|---|---|
| Workshop quote/request waiting | Care/Event Core |
| Order preparing | CommerceOrder |
| Municipal application under review | Municipal/Public-Life workflow state |
| Community membership pending | Community canonical membership state |

### PRÓXIMO
| Demo item | Intended canonical source |
|---|---|
| Medical appointment | Health Core + confirmed schedule |
| School activity | School relationship + confirmed schedule |
| Community event | Community event/calendar source |
| Vehicle inspection | Vehicle lifecycle Core + confirmed schedule |
| Pet vaccination | Pets lifecycle Core + confirmed schedule |

### PARA HOY
| Demo item | Intended canonical source |
|---|---|
| Relevant municipal benefit | Municipal Data Engine + eligibility/relevance |
| Important school/community notice | Community/School announcement source |
| Local news | News Engine + locality/recency/relevance |
| Seasonal food/local-life | Local-Life/Knowledge content source |
| Nearby weekend panorama | Events/Culture/Panoramas source |

## Replacement order

Replace only one source class at a time and keep the rest of the complete demo baseline visible.

1. Weather
2. Municipal benefits/services
3. Local news
4. Metro operational status
5. DTPM bus ETA
6. Care/Event state
7. CommerceOrder state
8. Community membership/announcements
9. School relationships/events/deadlines
10. Health confirmed schedules and follow-up
11. Vehicle lifecycle
12. Pets lifecycle
13. Seasonal local-life content
14. Culture/events/Panoramas

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

The number of visible rows is dynamic in production. The complete demo deliberately shows more categories than one real user would normally see at once so that product structure and design can be reviewed before live-data integration.
