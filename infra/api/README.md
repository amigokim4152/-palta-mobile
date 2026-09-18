# Palta API preflight

This API exists to keep mobile development independent from provider timing and to give every Palta module one trusted network boundary.

Runtime authority: `docs/PALTA_PLATFORM_RUNTIME_FOUNDATION_V1.md`.

Canonical production origin:

`https://api.somospalta.cl/v1`

First end-to-end slice:

`Home → Neighborhood → Business → confirmed action → Care → Home`

Rules:
- mobile consumes Palta API/contracts, not DTPM/municipality/payment/fiscal/provider APIs directly;
- provider credentials never ship in the app;
- public/canonical data and private personalization remain separable;
- Home and Push delivery are separate decisions;
- `RESULT != OUTCOME`;
- a business is canonical and reused across map/search/detail/care;
- money/fiscal multi-step mutations execute inside trusted API/worker database transactions;
- Supabase Data API is not the checkout/payment/fiscal transaction engine;
- public/static high-volume resources may use approved direct R2/edge delivery where no private authorization or mutation is required;
- this preflight contract may evolve before production freeze.

## Namespace direction

The platform-level API groups are:

```text
/v1/auth/session
/v1/me
/v1/home
/v1/places
/v1/businesses
/v1/community
/v1/market
/v1/transport
/v1/events
/v1/commerce
/v1/payments
/v1/fiscal
/v1/notifications
```

The existing `openapi.preflight.yaml` contains early vertical-slice paths such as `/v1/local/search`, `/v1/business/{businessId}` and `/v1/care`. Keep them working while the canonical namespace is introduced; do not break the runnable mobile slice merely to rename endpoints. New contracts should prefer the canonical namespace and use an explicit compatibility/deprecation path when replacing an old route.

## Implementation order

1. existing mock adapter/local mock API;
2. source-controlled `apps/mobile` runtime using the Palta API client;
3. local Worker/API adapter;
4. Supabase DEV managed PostgreSQL/Auth after explicit organization + current-cost approval;
5. Cloudflare DEV Worker/Hyperdrive/R2/Queues bindings;
6. first real non-money end-to-end vertical slice;
7. payment/fiscal sandbox workers after DB + secret boundaries are verified;
8. STAGING mirror;
9. production only after release gates.

## Database portability

Supabase managed PostgreSQL is the first DEV choice. Neon remains a PostgreSQL fallback/portability option; API/domain contracts must not depend on changing database provider semantics.
