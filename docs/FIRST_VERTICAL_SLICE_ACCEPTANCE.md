# First Vertical Slice Acceptance

Scenario:
A user in Santiago needs a nearby repair business.

1. Home opens without a menu wall.
2. User enters Neighborhood.
3. Map and list share the same selected business.
4. User opens the canonical business detail.
5. Public business facts are visible even if ownership is unverified.
6. Unverified ownership cannot publish controlled discounts/coupons.
7. User sends a quote/inquiry.
8. The action creates a Care track.
9. User leaves the detail screen.
10. Home now shows the waiting state.
11. A later response changes the same Care track, not a duplicate card.
12. Push is sent only when the state change warrants it.
13. Tapping Push returns directly to `/care/[id]`.
14. Completion removes or transforms the action card.
15. Result and outcome remain distinct.

## PASS gates

- no duplicate business entity
- no direct provider API call from mobile
- no secret in client bundle
- map/list selection survives transition
- Back restores viewport/filter/selection
- Home does not fill to a target number
- content/news can appear when personal cards are sparse
- busy Home demotes discovery content
- failed network does not reset the user's started action
- synthetic test data is excluded from real analytics
