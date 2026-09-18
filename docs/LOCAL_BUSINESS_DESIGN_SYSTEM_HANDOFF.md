# Local Business — Design System Handoff

Status: implementation handoff
Scope: `Negocios` discovery + public Business Profile

## 1. What is already a product decision

Do not undo these interaction decisions while polishing visual design:

- `Negocios` is a primary app surface immediately after Home.
- Discovery is map-led on mobile, with search/filter controls above and an overlaid result sheet below.
- Map and list are two projections of the same result set and preserve query, filters, selected Business, camera and return state.
- Moving the map does not automatically fire continuous searches; the user gets an explicit `Buscar en esta zona` action.
- A selected map pin is reflected in the result sheet before opening the full profile.
- Public Business Profile answers three questions immediately: what is this place/provider, can I use it now, and what can I do next.
- Current operational state is more important than generic directory metadata.
- Service-area businesses remain discoverable even when no exact public pin may be shown.
- Primary business actions appear before long descriptive content.
- Save/follow relationship actions remain distinct from transactions and from marketing/notification permission.
- Coupon, verified-use reviews, posts, external links and corrections stay attached to the same canonical Business.
- Quote/booking/order/messaging hand off to shared operational cores; Local Business must not create parallel systems.

## 2. Benchmark posture

Daangn/Karrot is the interaction-density and local-business usability benchmark, not a brand template.

Borrow:
- fast local scanning;
- compact hierarchy;
- business page as living local content;
- relationship/actions close to the entity;
- progressive disclosure instead of large control panels.

Improve for Palta:
- `open now / closed today / seasonal / stale` truth first;
- service-area providers;
- verified-use review provenance;
- Care follow-through after quote/booking/order actions;
- privacy-aware location precision;
- Chile-native WhatsApp/external-channel reality.

Do not copy Daangn colors, iconography, typography, illustrations or branded visual assets.

## 3. Current implementation surfaces

Canonical visible screens:
- `mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx`
- `mobile-overlay/src/features/business/BusinessProfileExperience.tsx`

Routes are intentionally thin wrappers so there is one visible implementation per experience.

Shared supporting components:
- `BusinessDiscoveryShell`
- `LocalResultCard`
- `MapResultSheet`
- `BusinessActionBar`
- `NeighborhoodMap`

## 4. Design-system work requested

Normalize these without changing product semantics:

- typography scale and letter spacing;
- icon family: search, back, saved, following, WhatsApp/call, quote, verified;
- elevation/shadow rules for floating search, map controls and bottom sheet;
- surface/card hierarchy;
- chip/filter states;
- button hierarchy and responsive action grid;
- image aspect ratios and placeholders;
- map pin selected/unselected/cluster treatment;
- bottom-sheet handle, gesture and snap affordances;
- skeleton/loading/empty/error visuals;
- spacing and safe-area behavior across smaller iPhones and Android devices;
- dark-mode-ready semantic colors if/when the global system supports it;
- accessibility contrast and 48px minimum touch targets.

## 5. Consumer UI guardrails

- Never expose internal taxonomy keys such as `AUTO_MOTO_MOBILITY` or `auto_repair`.
- Avoid developer/system language (`Map Core`, adapter names, entitlement names, internal status IDs).
- Do not make every section a bordered rectangle.
- Do not turn the profile into an admin dashboard.
- Do not show a control simply because the backend supports it; show it when it is useful in context.
- Keep external-link access free and visually subordinate to direct useful actions.
- Quiet/empty states are valid; do not fill screens with artificial cards.

## 6. Desired visual character

The target is calm, compact, local and trustworthy: fewer boxes, stronger whitespace hierarchy, strong real-business photography, clear live status, restrained Palta green, and content/actions that feel immediately usable rather than technically exposed.
