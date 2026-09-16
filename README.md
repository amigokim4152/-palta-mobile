# palta-app-prep-v4.5

Local staging package for the Palta app implementation handoff.

This is **not deployed** and **not merged to GitHub**. It exists to make the repository step immediate once GitHub access is available.

The core is intentionally UI-framework-neutral until the mobile repository/runtime decision is explicitly made.

Commands:

```bash
npm run typecheck
npm test
```

The code intentionally contains no external runtime dependencies.

CI staging is included at `.github/workflows/core-check.yml`. It installs the exact TypeScript dev dependency, then runs typecheck and core tests on integration branches and pull requests.


## v2 additions — 2026-09-16
- Benchmark-derived mobile interaction decisions
- Concrete 5-surface screen blueprint
- Provider readiness matrix and at-home setup order
- Initial provider simplification: Supabase + Cloudflare + Expo
- Expo Router mobile overlay (NOT VERIFIED until dependencies/native build)


## v2.2 additions — 2026-09-16
- Implementation-level Home/Neighborhood contracts
- Local Business verification/action flow
- API + DB preflight contracts
- Static mobile structure prototype
- Mobile overlay state/components
- Neon fallback account state verified without changing Supabase-first v1 decision


## v2.3 additions
- Map Core adapter boundary
- Palta API client
- offline mutation queue
- deep-link parser
- runtime env validation
- Supabase explicit grants/RLS draft


## v2.4 additions
- zero-dependency local Palta Mock API
- real HTTP smoke flow for Home → Local Search → Business → Care


## v2.5 additions
- API-driven Home screen
- API-driven Neighborhood results
- API-driven Business detail
- API-driven Care detail
- recoverable loading/error/empty states
- explicit development-location flow instead of fake life-area truth
- physical-iPhone private-LAN mock API support in development only


## v2.6 additions
- provider-neutral Location Core
- explicit exploring/current/home/work separation
- MutationQueueStore port
- deterministic mutation sync engine
- retryable vs terminal offline failure handling
- Expo Location/SQLite adapter boundaries


## v2.7 additions
- Expo Location foreground adapter
- Expo SQLite persistent mutation queue adapter
- MapLibre Neighborhood map surface
- canonical GeoJSON map projection
- foreground-only native permission config


## v2.8 additions
- Location/MapLibre/SQLite adapters are connected into the mobile flow
- map browsing uses a separate search origin
- retryable quote failures are persisted
- side-effect retries are idempotent


## v2.9 additions
- Cloudflare/R2 PMTiles Range Worker preflight
- read-only map route
- exact range verification script
- caching strategy that does not attempt to cache 206 via Cache API


## v3.0 — provider independence hardening
- AuthPort
- DatabasePort
- ObjectStoragePort
- NotificationPort
- EdgeRuntimePort
- KeyValueStorePort
- ProviderRegistry
- generic notification routing
- Supabase auth adapter template outside core
- read-only local environment preflight


## v3.1
- Auth provider injection
- public/private surface access policy
- provider-neutral notification envelope
- automated vendor-leakage gate


## v3.2
- Event Core port
- provider-neutral asset IDs
- provider-neutral release manifests
- cost guard logic


## v3.3
- safe integration-branch tooling
- non-destructive local asset inventory
- guarded Expo bootstrap
- deterministic at-home execution order


## v3.4
- reusable mobile component system
- accessibility interaction semantics
- Home density policy
- Business action priority/verification policy
- Care timeline
- Neighborhood map result sheet policy


## v3.5
- common component system integrated into actual Home/Neighborhood/Business/Care screens
- Home density policy applied to API response
- Neighborhood result sheet/filter UI connected to state
- Business actions resolved from capabilities
- Care timeline connected to API state


## v3.6
- Community first surface
- Market vertical surface + contextual create
- Play first surface
- Context Space promotion policy


## v3.7
- Palta Experience System v1
- presentation priority and surface decision rules
- adaptive large-text Focus Layout
- Reading Experience contract
- semantic haptic intent contract
- accessibility/discoverability QA rules


## v3.8
- inspectable Home reference UI
- Normal/Large/Accessibility simulations
- actual device font-scale adapter
- Palta semantic visual candidate tokens
- Reading Surface reference


## v3.9
- inspectable reference set: Home / Barrio / Business / Care / Reading
- provider-neutral HapticsPort and SpeechPort
- Expo adapter templates for computer/device phase


## v4.0
- scalable provider-neutral Payment Core
- shared Commerce models for permanent / temporary / mobile outlets
- TradingSession and Order contracts
- transaction ledger and payment routing
- system-wide expansion rules


## v4.1
- Security & Privacy foundation
- deny-by-default authorization
- business least-privilege roles
- data classification/minimization
- webhook replay protection
- secrets policy
- audit/abuse/security gates


## v4.2
- Life Event Exposure Guidance
- evidence-aware common-sense prompts
- direct/connect/confirm/user-action levels
- stolen vehicle / lost phone / lost keys starter playbooks


## v4.3
- Service Exchange & Partner Core
- quote routing by industry/service category
- fair organic provider competition
- progressive partner integrations
- revenue guardrails that preserve user trust


## v4.4
- development start/runbook and blocker recovery
- one-computer continuity plan
- provider activation matrix
- local/environment preflight scripts
- GitHub Core CI template


## v4.5
- computer-first readiness inspection
- install-once development setup
- explicit deferred-provider tooling
- controlled Day Zero development start
