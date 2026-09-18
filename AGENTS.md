# Somos Palta repository working contract

Read this before making changes anywhere in `palta-mobile`.

## Mobile runtime Source of Truth

Feature branches remain independent Sources of Truth for their own implementation. Do **not** judge the whole app by checking out one feature branch.

Whole-app iOS simulator/review is composed on:

- `integration/runtime-composition-v1`

Canonical composition contract:

- `docs/MOBILE_RUNTIME_COMPOSITION.md` on `integration/runtime-composition-v1`
- `manifest/mobile-runtime-composition.json` on `integration/runtime-composition-v1`

If the current branch does not contain those files, inspect them from the composition branch before changing any mobile-visible surface.

```bash
git fetch origin
git show origin/integration/runtime-composition-v1:docs/MOBILE_RUNTIME_COMPOSITION.md
git show origin/integration/runtime-composition-v1:manifest/mobile-runtime-composition.json
```

## Parallel-work rules

1. First inspect the current branch HEAD and existing implementation. Do not recreate work that already exists.
2. A feature branch owns only its declared surface or Core contract.
3. Shared shell/runtime paths are integrated through `integration/runtime-composition-v1`; do not overwrite unrelated tabs/screens from a feature branch.
4. `apps/mobile/src` is generated runtime output. Do not hand-edit it as Source of Truth.
5. Do not create duplicate Auth, Messaging, Map, Media, Care, Payment, Localization, Notification, or other Shared Cores inside a feature branch.
6. If a mobile-visible feature can be safely isolated, it may be registered as a `live_overlay`. If it changes shared contracts, keep it as a reviewed integration until those contracts are reconciled.
7. When a feature branch advances, ensure the composed runtime can detect or integrate that advance; do not leave a silent stale whole-app view.
8. Whole-app acceptance requires composed runtime typecheck and iOS bundle verification, not only the feature branch tests.
9. Do not merge feature work to `main` merely to make it visible in the simulator.
10. Keep user workflow simple: one composed simulator/runtime should show the latest reviewed Palta app while parallel branches continue independently.

## Current composed surfaces

At the time this contract was established:

- Home → `integration/home-functional-foundation-v1`
- Negocios → `integration/local-business-v1`
- Community → `integration/community-runtime-v1`

The manifest on `integration/runtime-composition-v1` is authoritative if this list changes.

## Shared/Core branches

Auth/Profile, Messaging, Commerce/POS, Localization, Map Runtime and other Shared Cores must be reconciled at contract/adapter boundaries rather than copied wholesale into feature screens.

When handing work to another chat/agent, include the current branch and tell it to read this file plus the composition contract before changing mobile runtime behavior.
