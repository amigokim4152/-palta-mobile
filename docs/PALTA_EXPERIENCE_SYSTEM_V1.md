# Palta Experience System v1

## Core principles

1. Content is the visual protagonist.
2. Recognition is dense; decisions are spacious.
3. Normal states are quiet; exceptions get attention.
4. Preserve context when a screen change is unnecessary.
5. Immediate action feedback; result feedback only as strong as necessary.
6. Important information is not hidden.
7. Secondary information may be summarized, but its existence must remain discoverable.
8. Large text is not a scaled-up normal layout. It is a reprioritized, reflowed layout.
9. Reading surfaces support large text, focus reading and speech.
10. Haptics communicate meaning, not every tap.

## Presentation priority

Every candidate can be evaluated on:

- urgency
- personal relevance
- action required
- risk
- freshness
- frequency

Risk, action and urgency dominate.

Possible presentation tiers:

- Focus
- Primary
- Secondary
- Glance
- Discover

Possible surfaces:

- Inline
- Glance Cluster
- List Row
- Action Surface
- Timeline
- Bottom Sheet
- Full Screen
- Alert

A content type is not permanently bound to one surface. Current state determines presentation.

## Large text / Focus Layout

### Normal

- may use two-column glance clusters
- up to 4 initial glance items
- up to 3 secondary items
- compact metadata allowed

### Large

- one-column layout
- up to 3 glance items
- up to 2 secondary items
- explicit text labels preferred
- primary actions can stack vertically

### Accessibility

- one-column layout
- up to 2 glance items
- one secondary item before "more"
- explicit labels
- full-height sheets preferred
- horizontal metadata compression avoided

The remaining information is still available; it is not deleted.

## Discoverability

Do not use a bare chevron, accordion caret, swipe or long press as the only way to reach important information.

Prefer:

- "모두 보기"
- "전체 보기"
- "진행 과정 보기"
- "생활정보 3개 더"

The summary reveals that more content exists.

## Reading Experience

Reading modes:

- Standard
- Focus
- Listen

Content speech order is based on semantic reading blocks, not raw screen text.

Never read UI chrome such as:

- save button
- share button
- menu labels
- unrelated recommendations

Reading progress stores semantic block position and can be shared between visual and listen modes.

## Haptics

Palta semantic haptics:

- none
- selection confirmed
- success
- warning
- error

No haptic for:

- navigation
- opening detail
- ordinary filter toggles
- map selection
- scrolling
- sheet opening

Success is emitted after meaningful completion, not merely after a tap.

Queued offline work is not treated as completed.

## QA gate

A screen is not complete until it is checked for:

- normal text
- large text
- accessibility text
- small Android screen
- iPhone
- Android
- reduced motion
- screen reader basics
- text clipping/overlap
- inaccessible actions
- discoverability of hidden detail
