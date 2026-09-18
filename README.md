# Palta Mobile

Official mobile application repository for Somos Palta.

## Canonical identity

- Public brand: `Somos Palta`
- App display name: `Palta`
- Repository name: `palta-mobile`
- Internal namespace: `palta`
- iOS bundle identifier: `cl.somospalta.app`
- Android application ID: `cl.somospalta.app`
- Deep-link scheme: `palta`

If GitHub still displays the repository as `-palta-mobile`, the repository-level rename has not yet been completed. Do not create a replacement repository; preserve this repository and its full history. See `docs/REPOSITORY_RENAME_RUNBOOK.md`.

## Repository role

This repository contains the Palta mobile/runtime implementation, provider-neutral product cores, adapter boundaries, infrastructure contracts, and integration verification. The implementation is developed on `integration/*` branches. `main` remains the minimal baseline until an explicit verified merge decision is made.

Provider-specific integrations belong behind adapters and infrastructure boundaries. Product code must not depend on Base44, NAREVU, Chile-K, or other legacy product identifiers as current namespaces.

## Verification

Use Node.js 22 or newer.

```bash
npm ci
npm run verify
```

The verification path includes TypeScript checks, executable core tests, provider-independence checks, and CI database preflight where configured. A check that could not run is `NOT VERIFIED`, not `PASS`.

## Mobile runtime identifiers

The Expo configuration uses:

```text
name: Palta
slug: palta
scheme: palta
iOS: cl.somospalta.app
Android: cl.somospalta.app
```

These are stable technical identifiers and should not be changed merely because a repository or marketing label changes.

## Key documents

- `docs/NAMING_AND_REPOSITORY_STANDARD.md` — canonical naming rules
- `docs/REPOSITORY_RENAME_RUNBOOK.md` — repository rename and post-rename verification
- `docs/IMPLEMENTATION_HANDOFF.md` — original implementation handoff context
- `docs/BUILD_ORDER.md` — build and merge discipline
- `docs/APP_SHELL_ROUTE_CONTRACT.md` — app shell routing contract
- `docs/FIRST_VERTICAL_SLICE.md` — first end-to-end vertical slice

## Core direction

The application is organized around reusable Palta cores rather than isolated screens. Current major areas include Home, Community, Local Business, Commerce/Payment/POS, Care/Event, Location/Map, Messaging, and supporting provider-neutral infrastructure.
