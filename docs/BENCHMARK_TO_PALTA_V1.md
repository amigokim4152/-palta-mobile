# BENCHMARK → PALTA DECISIONS v1

Date: 2026-09-16
Status: IMPLEMENTATION INPUT

Palta does not copy another product's visual design. It borrows interaction mechanics only when they solve Palta's own product problem.

## 1. Karrot / 당근
Use:
- Neighborhood as a persistent geographic context, not merely a search filter.
- Hyper-local trust and area membership are distinct from broad discovery radius.
- Local feed can combine recency, relevance, and personalization.
- Community membership should not expose an exact home location.

Do not copy:
- Do not make the main Home a marketplace feed.
- Do not make location verification a large repeated UI element across every screen.

Palta translation:
- `home_area`, `work_area`, `current_location`, and `exploring_location` remain distinct.
- Neighborhood/Community can use local membership signals.
- Personal Home only consumes location when it materially changes the person's life context.

## 2. NAVER Map
Use:
- One strong map surface shared across place, transit, and local discovery.
- Search stays close to the map.
- Map controls are compact and predictable.
- Search/list/map state must remain synchronized.

Do not copy:
- Palta should not expose every map layer at once.
- The map must not become a separate giant product silo.

Palta translation:
- One Map Core.
- Domain adapters provide Business, Property, Mobility, Event, Public Service layers.
- Mobile: map + bottom sheet + list.
- After map pan: explicit `Search this area`.
- Current-location control is compact and singular.

## 3. Airbnb
Use:
- Map and list are two views of the same result set.
- Context (destination/date/people) changes what is relevant.
- Save actions can feed an itinerary/context without duplicating the entity.
- Progressive filters; do not show every filter initially.

Do not copy:
- Palta is not a booking catalog and should not rank everything by commercial conversion.
- Personal Home must not become a discovery catalog.

Palta translation:
- Property and Play use map/list + context.
- Travel becomes a Context Space.
- Saved objects remain canonical; context stores relationships/state only.

## 4. Uber
Use:
- One search can connect multiple services.
- Active work is tracked in a dedicated status/activity model.
- User actions return to a clear current state.
- Search asks for the user's intent first, then narrows.

Do not copy:
- Palta Home should not be a launcher grid for all services.
- Commercial service suggestions must not push important life tasks down.

Palta translation:
- Unified Search resolves Person / Place / Business / Public Action / Content / Intent.
- Ongoing Palta work lives in Care/Event state and projects into Home.
- A user can enter from any surface, act, then return to Home/follow-up.

## Resulting Palta mobile grammar

1. Persistent bottom navigation: Home / Neighborhood / Community / Market / Play.
2. Search is contextual but one underlying resolver.
3. Map is a shared view, not a permanent bottom tab.
4. Create/Post is contextual, not a permanent bottom tab.
5. Home is private life state first; discovery content expands only when useful.
6. Important state survives navigation, app backgrounding, and deep-link return.
7. Surface complexity grows progressively, never all at once.

## References reviewed
- Karrot Local Groups / neighborhood model: https://us.karrotmarket.com/wv/faqs/1024
- Karrot company/product overview: https://www.karrotmarket.com/about/
- NAVER Map mobile help: https://help.naver.com/service/5637/contents/18596?osType=MOBILE
- Airbnb search/map behavior: https://www.airbnb.com/help/article/252
- Airbnb 2026 product release: https://news.airbnb.com/product-releases/airbnb-2026-summer-release
- Uber redesigned app / Activity: https://www.uber.com/us/en/u/redesigned-uber-app/
- Uber GO-GET 2026 / One Search: https://www.uber.com/gb/en/newsroom/go-get-2026/
