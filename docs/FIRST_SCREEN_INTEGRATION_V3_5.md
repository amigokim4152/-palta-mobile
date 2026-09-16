# First-screen integration v3.5

## Home

Now uses the real Home density policy:
- action/status/useful first
- discovery capped automatically
- quiet end-state allowed
- no fixed card count

## Neighborhood

Now uses:
- reusable filter chips
- MapResultSheet snap state
- shared map/list selection
- verified filter
- map result list derived from the same API result set

`open_now` is visible as a UI contract but is **not yet applied to result filtering**, because the current Local Search response does not contain a reliable normalized open/closed field. We do not fake this.

## Business detail

Now uses capability-driven action resolution.

Initial capabilities are inferred only from actual available fields:
- quote: current first vertical slice
- WhatsApp: only when contact exists
- call: only when phone exists
- save: common Palta action

Unconnected actions display a non-success placeholder instead of pretending they worked.

## Care

Now uses the shared timeline:
`Discover → Prepare → Act → Wait → Result → Follow-up → Outcome`

Result and Outcome remain separate.
