# PALTA CORE ICON SET v1

Status: SEMANTIC REGISTRY READY / VISUAL GEOMETRY NOT FROZEN
Branch: `integration/design-system-v1`
Gate: B — Palta Core Icon Set v1

## 1. Purpose

Make Palta recognizable through one functional icon language across Home, Neighborhood, Community, Market, Transport, Health, Business/POS, Messaging and future domains.

Icons are product language. Domain teams do not choose unrelated icon packs independently.

## 2. Visual direction

The final drawing system must feel:

- clear before decorative
- human but not childish
- calm, practical and trustworthy
- slightly organic where appropriate, without harming recognition
- visually compatible with the Palta symbol/character universe without turning utility icons into mini mascots

The icon set must work in monochrome. Brand color is an application layer, not the definition of the icon.

## 3. Geometry constraints to validate

Not frozen yet, but the final set must standardize:

- canonical square viewBox
- optical bounding box
- baseline/alignment
- stroke family or filled/outline policy
- corner treatment
- minimum small-size legibility
- active/selected state treatment
- RTL impact where applicable
- accessibility labels in implementation

Do not draw final SVG assets until the visual comparison set has been reviewed.

## 4. Core semantic set

### Navigation

- home
- neighborhood/local
- community
- market
- play/panoramas

### Actions

- search
- back
- close
- more
- add
- edit
- share
- save
- send
- filter
- sort
- report
- block
- mute

### Location & utility

- location
- current-location
- map
- calendar
- clock
- photo
- camera
- attachment

### Domain

- message
- business
- transport
- health
- school
- pet
- property
- job

### Trust & status

- verified
- shield/privacy
- info
- success
- warning
- critical
- realtime
- stale
- offline

Canonical semantic registry: `src/ui/icons.ts`.

## 5. Prohibited patterns

- Unicode emoji for bottom navigation
- Unicode emoji for verification/status/action defaults
- one icon library per domain
- same glyph used for two materially different meanings without an explicit context rule
- visually different verification icons in Community vs Business vs Public services
- redrawing official Palta symbol into utility icons
- decorative avocado shapes for every command

## 6. Reaction layer is separate

Reactions are not functional icons.

Initial meanings to design later as Palta expressive micro-assets:

- appreciate / like
- helpful
- celebrate
- curious
- concerned
- welcome

These should relate visually to the Character/Expression system. They must still remain understandable as reaction meanings and must not require the full character illustration.

## 7. First visual comparison sheet

Before freeze, produce one sheet showing the same candidate style applied to at least:

- Home
- Search
- Location
- Message
- Community
- Market
- Calendar
- Transport
- Verified
- Warning
- Save
- Share

Review at 16, 20, 24 and 32 px/dp-equivalent optical sizes.

The comparison should answer:

1. Are all icons visibly one family?
2. Is recognition immediate at small size?
3. Does the set feel too generic?
4. Does adding Palta personality reduce usability?
5. Does the family coexist with the official wordmark/symbol without competing with it?

## 8. Freeze gate

Icon geometry may be frozen only after:

- visual comparison sheet review
- small-size mobile test
- light/dark surface test
- monochrome test
- Home/Map/Community application test
- accessibility label mapping review

Until then, semantic keys are stable but the vector drawings are replaceable.
