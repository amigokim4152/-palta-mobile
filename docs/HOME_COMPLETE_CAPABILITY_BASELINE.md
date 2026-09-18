# Home Complete Capability Baseline

Status: function-first development baseline before final visual design and before production regional filtering.

## Product rule

Personal Home has two separate concepts:

1. **Capability universe** — everything Palta must be able to represent somewhere in Chile or in a relevant personal/travel context.
2. **Production projection** — the small subset relevant to this user, locality, relationship, asset, lifecycle state, trip, interest, and current event.

A capability must never be deleted merely because it is irrelevant in one locality. Example: marine alerts remain a first-class Home capability even though an inland Santiago user normally should not see them.

During complete development Demo mode, broad capability coverage is intentionally visible so omissions can be detected before regionalization and final design.

## Legacy Base44 life-card parity recovered

The independent Home preserves the legacy HomeLifeCard/local-life capability family:

- current weather
- near-term precipitation
- UV
- air quality
- RM vehicle restriction
- commute traffic
- maritime forecast
- marejadas / marine alerts
- tides
- tsunami alerts
- general emergency alerts
- earthquake events
- strong wind
- snow / ice
- wildfire
- river / flood
- mountain / road conditions
- border crossing status
- extreme heat / cold
- exchange rates
- UF
- nearby fuel prices
- ODEPA/public food prices
- Daily Brief / Breves de hoy
- Chile annual cultural/seasonal rhythm

The rebuild additionally keeps seasonal food split into separate fruit, vegetable and seafood capabilities.

## Legacy subfeatures that must not disappear

The migration is not complete if only a card title survives. Important legacy behavior includes:

- Weather: current temperature, apparent temperature, daily min/max, near-term precipitation, UV, hourly context.
- Exchange: USD/CLP, selected personal currency, conversion to CLP, detailed history, 7-day and 28-day outlook where supported.
- UF: current reference date/value and historical views.
- Traffic: current vs normal duration, delay, alternative route and potential time saving.
- Road: normal / precaution / chains required / restricted / closed semantics.
- Border: open / closed / restricted state, hours, reason and official evidence where available.
- Fuel: nearby station, fuel type, current price, previous price and price change.
- Food prices: product, relevant market/region, observed price and observation date.
- Daily Brief: concise transport/economy/policy/society/safety/weather/culture summary.

## Food is multiple capabilities, not one card

Keep these distinct:

- `today.seasonal_fruit`
- `today.seasonal_vegetable`
- `today.seasonal_seafood`
- `today.food_prices`
- `today.nearby_food_available`

`today.nearby_food_available` preserves the legacy time-aware behavior: lunch delivery, afternoon take-home, or evening delivery is shown only when the business is accepting orders and the product is actually available. A sponsored item is not eligible merely because it is sponsored.

## Personalization and notices

Keep distinct:

- private user Notification Inbox
- public Palta operating notices (`today.palta_notice` / `entry.notices`)
- explicit interest editing (`entry.interests`)
- interest-driven Home prioritization (`today.interest_personalization`)

## Stable Home entry capabilities recovered from Base44

Visual placement may change, but these entry capabilities must survive migration:

- Search
- Nearby
- Local Business
- Real Estate
- Community
- Map
- Health
- Pets
- Education / School
- Marketplace
- Jobs
- Food
- Events
- Exchange / UF details
- Interests
- Kids
- Services / Care request
- Public Palta notices
- More / complete navigation

## Regionalization rule

Complete Demo: show broad coverage for operator/product QA.

Production examples:

- Santiago / RM: air quality and vehicle restriction may be relevant; marine and border cards are not shown by geography alone.
- Coastal locality: maritime forecast, marejadas, tide and tsunami capabilities may become eligible.
- Border / foothill locality: border status, mountain-road conditions and snow/ice may become eligible.
- Rainy / river locality: flood/river capabilities may become eligible.
- Wildfire-risk locality: wildfire capability may become eligible.

Geographic eligibility only enables a capability. It never fabricates an active alert. Safety/event cards still require verified current evidence and freshness.

## Data migration rule

Home does not bind directly to provider schemas. The canonical/shared-data owner projects into stable Home capability keys.

See:

- `src/home/homeCapabilityRegistry.ts`
- `src/home/homeLifeCardParity.ts`
- `src/home/homeLifeCardEligibility.ts`
- `src/home/homeEntryCapabilityParity.ts`
- `src/home/homeCapabilitySourceBindings.ts`

This allows Base44-era collectors/data to be replaced with independent Palta infrastructure without redesigning Home each time.

## Current development behavior

The function-first branch keeps the existing provisional visual composition. Demo fixtures fill missing life-card slots only when a real/API-provided item with the same `capability_key` is absent. Real data therefore replaces Demo data in place rather than creating a second card system.

Final visual composition and production regional filtering come after capability completeness has been reviewed.
