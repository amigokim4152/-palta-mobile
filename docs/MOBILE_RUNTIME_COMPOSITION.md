# Somos Palta mobile runtime composition

## Purpose

Feature branches remain independent Sources of Truth, but the iOS simulator must show one coherent Palta app instead of whichever feature branch happens to be checked out.

The simulator/runtime integration branch is:

- `integration/runtime-composition-v1`

Do not merge feature work into `main` just to make it visible in the simulator.

## Repository-wide discovery

This contract must be recoverable without prior chat context.

Repository-wide entry points are:

- `AGENTS.md` on `main`
- `AGENTS.md` on `integration/runtime-composition-v1`
- GitHub Issue #9: `[Source of Truth] Mobile runtime composition for parallel feature work`
- this document
- `manifest/mobile-runtime-composition.json`

A new chat/agent working on any Palta mobile branch should inspect the repository-wide `AGENTS.md` and this composition contract before changing mobile-visible behavior.

## Rules

1. A feature branch owns only its declared surface paths.
2. Shared shell paths (`app/_layout`, tab layout, theme, services, shared API client and runtime scripts) are owned by the composition branch.
3. A surface may be integrated in one of two modes:
   - `live_overlay`: isolated UI paths can follow a feature branch automatically.
   - `reviewed_snapshot`: the source branch is pinned until its Shared Core/API contract has been reviewed against the composed runtime.
4. Never synthesize a second Messaging, Map, Media, Auth, Care, Payment or other Shared Core just to make a feature screen work.
5. Production code must not silently fall back to fake service implementations. Development-only preview data is allowed when it is visually labelled or otherwise clearly scoped to development.
6. `apps/mobile/src` is generated runtime output. Do not hand-edit it.
7. `mobile-overlay/src` on a feature branch remains that feature's versioned UI source. The composed simulator may overlay approved source paths into generated `apps/mobile/src`.
8. Any source branch advance for a `reviewed_snapshot` must be reported as `REVIEW REQUIRED`; it must not silently replace the reviewed composition.
9. CI must typecheck and bundle the actual composed `apps/mobile/src`, not only a source branch's `mobile-overlay`.
10. A new mobile workstream must leave a discoverable handoff to this contract instead of relying on conversational memory.

## Current surface registry

The canonical registry is `manifest/mobile-runtime-composition.json`.

Current surfaces:

- Home → `integration/home-functional-foundation-v1` (`reviewed_snapshot`)
- Negocios → `integration/local-business-v1` (`live_overlay`)
- Community → `integration/community-runtime-v1` (`reviewed_snapshot`)

Shared/Core branches being integrated separately include Auth/Profile, Messaging, Commerce, Localization and Map Runtime. These are not UI overlays and must be reconciled at their contracts/adapters instead of copied wholesale.

## Simulator workflow

Use the composition branch when reviewing the whole app:

```bash
npm run dev:ios
```

On `integration/runtime-composition-v1`, this command:

1. validates the composition manifest,
2. materializes reviewed composition sources,
3. fetches and overlays live feature surfaces,
4. starts the runtime watcher,
5. starts/reuses the branch-compatible local mock API,
6. builds/launches the native iOS app with MapLibre,
7. leaves generated source ready for Expo Fast Refresh.

The watcher polls feature sources and the composition branch. It uses safe fast-forward only and does not overwrite tracked local edits.

## Adding another visible feature

Before adding a new surface:

1. Identify its real Source of Truth branch.
2. Identify the smallest set of UI paths it owns.
3. Ensure those paths do not overlap another surface or shared composition paths.
4. If it needs only isolated UI code, register it as `live_overlay`.
5. If it changes a shared API/Core contract, integrate the shared contract first and keep the surface `reviewed_snapshot` until verified.
6. Add runtime assertions for the visible feature.
7. Require composed runtime typecheck + iOS bundle CI to pass.
8. Update the repository-wide handoff pointers when the composition contract materially changes.

This keeps parallel development visible without letting one feature branch regress or overwrite another feature's latest reviewed runtime.
