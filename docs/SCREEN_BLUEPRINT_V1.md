# PALTA MOBILE SCREEN BLUEPRINT v1

Status: READY FOR IMPLEMENTATION SCAFFOLD
Target: iOS / Android first

## Global shell

Bottom navigation:
`Home | Neighborhood | Community | Market | Play`

Global rules:
- Search appears where it is useful; it is not a sixth tab.
- Map appears inside location-based surfaces; it is not a sixth tab.
- Create/Post appears in the current context; it is not a sixth tab.
- Back restores scroll/filter/map viewport where practical.
- Push/deep links return to the exact state, not merely Home.

## Home

Purpose: private life inbox.

Top:
- Compact Palta identity.
- Compact locality/context chip.
- Search entry: short, not hero-sized.
- Notification/status access only when there is something meaningful.

Body ordering:
1. Action / deadline / changed state.
2. Waiting / progress / result.
3. Today-useful life signals.
4. Local/news/content discovery when the first groups are sparse.
5. Stop. Do not fill the screen for density.

Card grammar:
- Information
- Action
- Status
- Alert
- Content

Every card should answer at most:
- What happened?
- Why does it matter to me?
- What is the next action?

## Neighborhood

Purpose: see and act on nearby life.

Default mobile composition:
- Top search field.
- Compact area selector.
- Minimal contextual filter chips.
- Shared Map Core.
- Draggable bottom sheet with visible-area results.
- `Search this area` after pan.
- Map/list share the same selected object.

Initial layers:
- Business / Place
- Public service / facility
- Benefits when actually applicable
- Later: Property, Event, Community signals

Do not expose precise private home coordinates.

## Community

Purpose: local/group relationships and structured conversation.

Top:
- My locality or current group context.
- Search current context.

Body:
- Relevant local feed.
- My groups.
- School/church/private group entry only for authorized members.
- Local reporting/action handoff where applicable.

Exact household location is never a public feed field.

## Market

Purpose: browse and transact.

Initial verticals:
- Secondhand
- Property
- Auto
- Jobs

Rules:
- Each vertical keeps its own search grammar.
- Common identity/media/trust/map/messaging cores are reused.
- Create action appears only inside the relevant vertical.
- Property and location-heavy verticals reuse Map Core.

## Play

Purpose: time-based discovery: food, events, culture, travel, lodging.

Top context:
- Where
- When
- Who, only when necessary

Travel can create a temporary Context Space.
Saved places/events attach to that context without duplicating canonical objects.

## Search

Underlying resolver returns grouped intent-aware results:
- Places / Businesses
- Public actions / programs
- Events / content
- Market entities
- Personal state only when authenticated and appropriate

Search history or browsing alone does not become a confirmed life fact.

## First production vertical slice

`Home → Neighborhood → Place/Business → Detail → Save/Regular → Contact/Reservation/Quote → Waiting/Status → Home`

Acceptance:
- Entity remains one canonical object.
- Action creates a Care/Event state.
- Leaving and reopening does not lose state.
- Home changes because state changed, not because a domain hard-coded a Home card.
