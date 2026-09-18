# Palta Naming & Repository Standard

Status: canonical naming standard for Somos Palta application repositories and runtime identifiers.

## Product names

- Company / public brand: `Somos Palta`
- Consumer app display name: `Palta`
- Core code namespace: `palta`
- Primary mobile repository: `palta-mobile`

## Mobile identifiers

- Expo app name: `Palta`
- Expo slug: `palta`
- Deep-link scheme: `palta`
- iOS bundle identifier: `cl.somospalta.app`
- Android application ID: `cl.somospalta.app`

These identifiers are stable technical IDs. Do not rename them for marketing copy changes without an explicit migration plan.

## Repository rules

1. Preserve the existing repository history. Rename the current GitHub repository; do not create a replacement repository.
2. Canonical GitHub path after the repository-level rename: `amigokim4152/palta-mobile`.
3. Existing `integration/*` branch names remain unchanged unless a branch-specific migration requires otherwise.
4. New code and documentation must not introduce `NAREVU`, `Chile-K`, `palta-app-prep-*`, or Base44 as current product/runtime identifiers.
5. Historical migration notes may retain legacy names when required to explain provenance.
6. Provider-specific names such as Supabase, Cloudflare, Expo, MapLibre, Mercado Pago, COMGES, or Sentry belong only in adapter/infrastructure boundaries; they are not product namespaces.

## Service naming

Use `palta` as the stable internal prefix and `somospalta.cl` as the public domain root.

Recommended patterns:

- API: `api.somospalta.cl`
- Core packages/modules: `palta-core`, `commerce-core`, `community-core`, `transport-core`
- Product surfaces: `Palta Business`, `Palta Health`, `Palta POS`

## Repository rename migration checklist

When GitHub repository settings access is available:

1. Rename `-palta-mobile` to `palta-mobile` in GitHub Settings.
2. Confirm all branches and commits remain present.
3. Update local remotes to `https://github.com/amigokim4152/palta-mobile.git`.
4. Verify GitHub Actions on an `integration/*` branch.
5. Verify any external deployment Git integration that stores the repository slug rather than repository ID.
6. Check OAuth callback/deep-link configuration independently; do not change `cl.somospalta.app` or the `palta` scheme merely because the repository was renamed.
7. Search active code/configuration for the old repository path and legacy product identifiers before merging normalization changes.

## Current normalization note

The root npm package name is canonicalized to `palta-mobile`. The app configuration already uses `Palta`, `palta`, and `cl.somospalta.app`, so those identifiers require no migration.
