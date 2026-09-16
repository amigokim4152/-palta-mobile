# Palta Provider Independence Contract
Version: 3.0
Date: 2026-09-16

## Non-negotiable rule

Palta Core must not depend on a single infrastructure vendor.

Providers are replaceable implementation details.

## Core owns

- canonical domain contracts
- Home composition
- Care/Event state
- permissions/authorization rules
- location semantics
- business verification semantics
- search/result contracts
- notification policy
- offline mutation semantics
- idempotency semantics
- API contracts
- public/private data boundaries

## Providers may implement

### Auth
Candidates:
- Supabase Auth
- Clerk
- future custom/OIDC

Core interface:
`AuthPort`

### Database
Candidates:
- Supabase Postgres
- Neon Postgres
- future managed/self-hosted Postgres

Core interface:
`DatabasePort`

### Object storage
Candidates:
- Cloudflare R2
- S3-compatible storage
- Supabase Storage

Core interface:
`ObjectStoragePort`

### Edge/API runtime
Candidates:
- Cloudflare Workers
- Vercel/Node
- self-hosted service

Core interface:
`EdgeRuntimePort`

### Notifications
Candidates:
- Expo Notifications
- OneSignal
- native APNs/FCM directly later

Core interface:
`NotificationPort`

### Maps
Candidates:
- MapLibre renderer + PMTiles
- alternative vector tile host

Palta owns the map data/style contract; renderer/hosting remain replaceable.

## Forbidden coupling

Do not:
- import Supabase SDK inside domain/core modules
- store service_role/secret keys in mobile code
- make Cloudflare-specific object keys part of canonical IDs
- make Expo notification tokens part of user identity
- make R2 URLs canonical entity identifiers
- let provider table names become product contracts
- let UI screens call provider SDKs directly

## Allowed provider-specific code

Only inside:
- `adapters/`
- `infra/`
- provider bootstrap/config files

## Migration principle

A provider change may require adapter/infrastructure migration, but must not require rewriting:
- Home Composer
- Care state machine
- canonical object model
- app navigation model
- domain policies

That is the definition of Palta infrastructure independence.
