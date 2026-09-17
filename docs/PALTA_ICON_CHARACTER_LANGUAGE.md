# PALTA ICON & CHARACTER LANGUAGE

Status: ACTIVE DESIGN-SYSTEM FOUNDATION
Version: 1.0

## 1. Goal

Palta should feel recognizable even when the logo is not visible. Functional icons, reactions, illustrations, characters and small expressive assets must belong to one coherent visual language.

This document prevents each domain from mixing arbitrary emoji, unrelated icon packs and one-off illustrations.

## 2. Three visual-expression layers

### Layer A — Functional icons

Used for navigation, actions, states and utility controls.

Examples:
- home
- search
- map/location
- message
- community
- market
- calendar
- transport
- health
- business
- edit
- share
- save
- report
- block/mute
- verified/trust
- warning

Rules:
- simple and immediately legible
- consistent optical weight
- consistent bounding box and alignment
- one canonical icon per meaning where possible
- no decorative personality that harms recognition
- platform symbols may be used only where platform convention is stronger and the Design System explicitly maps them

### Layer B — Product reactions and expressive micro-assets

Used where emotion/context helps but a full character illustration is unnecessary.

Examples:
- like/appreciation
- helpful
- celebrate
- curious
- concerned
- welcome

Rules:
- do not default to random Unicode emoji as branded UI
- reaction meaning must remain understandable without relying only on facial style
- reaction assets should visually relate to the Palta character/expression universe
- user-entered emoji remains user content and is not restricted by this rule

### Layer C — Palta Character Universe

Used for Living Examples, onboarding, local stories, selected empty states, social content and contextual warmth.

Canonical source:
`Somos Palta / 00_Foundation / 01_Brand_Design_System / 02_Character_Living_Example_System`

Principle:
`ONE CHARACTER UNIVERSE -> APP + QA + LOCAL STORIES + SOCIAL + CAMPAIGN`

## 3. Emoji policy

### Allowed

- emoji typed by users in posts/messages/comments
- emoji inside imported/source content where it is genuinely part of that content
- temporary internal prototype labels that never ship

### Not allowed as final Palta UI defaults

- emoji as bottom-tab/navigation icons
- emoji as core action icons
- emoji as verification/trust indicators
- emoji as default status/error/success system
- different emoji sets per domain
- using an emoji simply because a Palta icon is missing

Missing icon behavior:

1. record the semantic need
2. map to an existing canonical icon if equivalent
3. otherwise add it to the icon registry backlog
4. only then produce an approved asset/component

## 4. Icon construction principles

Final numerical geometry is frozen only when the visual set is produced, but every icon must share these principles:

- common artboard/bounding-box system
- common optical center
- common corner language
- common stroke/fill strategy
- common terminal/end-cap language
- consistent treatment at small sizes
- active/inactive states should not require a completely different drawing
- icons must support light/dark or foreground-color adaptation

Avoid mixing visibly different families such as rounded outline + heavy filled + hand-drawn glyphs in the same functional layer.

## 5. Icon naming

Canonical semantic naming, not page naming.

Good:
- `icon.search`
- `icon.location`
- `icon.message`
- `icon.calendar`
- `icon.share`
- `icon.warning`

Avoid:
- `communitySearchIcon2`
- `businessGreenPin`
- `marketCuteHeart`

Domains consume semantic icons; they do not own them.

## 6. Character asset rules

Characters must come from the approved registry.

Each character may have:
- canonical master
- avatar
- expressions
- poses
- outfits
- props
- scenes
- social exports

Recommended naming remains aligned with the existing implementation spec:
`PALTA_CHAR_{CHARACTER}_{TYPE}_{VARIANT}_vNN.*`

Domain workstreams cannot:
- redraw a character
- change proportions/style independently
- create a lookalike substitute
- create an unrelated mascot

## 7. Character tone and frequency

Characters support information; they do not compete with it.

Use when:
- demonstrating how a feature works
- providing Living Example content
- giving light contextual guidance
- making selected onboarding/empty states less sterile
- connecting local stories with the Palta brand universe

Do not automatically attach a character to every card, notification or screen.

## 8. Sensitive-context restriction

Character-forward expression is restricted for:
- serious medical/health warnings
- disaster/emergency
- domestic violence/crime
- death
- major legal/tax consequences
- debt/enforcement/high-risk financial states

Use direct, calm, information-first UI instead.

## 9. Avatar and identity use

Public profiles may show user photos, pets, objects, business marks or illustrations according to product policy.

Official Palta example profiles must:
- use registered Palta assets
- remain identifiable as Palta example/official character identity
- not impersonate real people or real businesses
- remain data-separated as synthetic/example content

## 10. Motion

Branded micro-motion may be added later, but it must derive from the same asset language.

Examples:
- subtle acknowledgement
- loading/delivery state
- character blink/wave only in suitable contexts

Do not use excessive looping animation. Functional clarity and performance have priority.

## 11. Initial registry targets

The first coherent set should cover:

### Navigation/core
- Home
- Neighborhood/Location
- Community
- Market
- Discover/Panoramas
- Messages
- Profile
- Notifications

### Actions
- Search
- Filter
- Add/Create
- Edit
- Delete
- Save
- Share
- More
- Back
- Close
- Send
- Call
- WhatsApp/external contact mapping
- Calendar
- Directions

### Trust/status
- Verified
- Unverified
- Pending
- Success
- Warning
- Error
- Offline
- Stale/update needed

### Domain primitives
- Business/store
- Job/work
- Home/property
- Vehicle
- Bus
- Metro
- School
- Health
- Pet
- Municipality/public service
- Event

## 12. Implementation rule for all workstreams

If a workstream needs an icon/reaction/character asset not in the registry, it must raise a shared-design requirement rather than silently introducing a new style.

This rule applies even to small details. Consistency at small scale is how the Palta identity accumulates.