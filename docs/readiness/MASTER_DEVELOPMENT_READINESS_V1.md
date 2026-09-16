# Palta Master Development Readiness v1

Status vocabulary:
- READY
- READY_WITH_MOCK
- WAITING_EXTERNAL
- NOT_VERIFIED
- BLOCKED

## Ready now in the preparation package

- canonical architecture
- provider adapter pattern
- Home / Neighborhood / Community / Market / Panoramas IA
- Care/Event foundation
- Payment/Commerce foundation
- Partner Core
- Service Exchange
- Life Event guidance
- Security/Privacy policy
- UI/UX Experience System
- accessibility / Reading / haptic/speech contracts
- reference UI screens
- POS direction owned by Palta
- development blocker-recovery policy

## Must be verified on the actual computer

- OS / architecture
- Git
- Node/npm
- GitHub permissions
- actual repository state
- integration branch
- Expo/native runtime
- device/simulator behavior

## External accounts deliberately deferred

- Supabase
- Cloudflare resource creation
- payment providers
- Apple/Google store accounts
- institutional partner APIs

They are not day-zero blockers.

## Development start condition

Development begins only after:

1. `machine-readiness-check.sh` has no MISS.
2. repository is open on the correct integration branch.
3. `npm ci` succeeds.
4. `npm run verify` passes.
5. no secrets are committed.
6. reference UI can be inspected.

Then begin:

**Home → Neighborhood → Business → Care**
