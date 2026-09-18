# Palta Mobile Runtime Promotion v1

Date: 2026-09-17
Status: execution checklist
Canonical target: `apps/mobile`

## Why this exists

The Palta Expo application already exists on the development Mac at `apps/mobile` and has been used by the iOS Simulator workflow, but that application directory is not currently committed to GitHub.

Do not create another Expo app. Promote the existing runtime safely.

## Source-of-truth transition

Before promotion:

```text
local apps/mobile      = runnable local application
mobile-overlay         = version-controlled recovery/reference fragments
GitHub apps/mobile     = absent
```

Target:

```text
GitHub apps/mobile     = canonical mobile runtime
local apps/mobile      = checkout/build of canonical runtime
mobile-overlay         = reference/recovery only; no parallel feature development
```

## Phase 1 — inspect, do not mutate

Run from repository root:

```bash
bash scripts/check-mobile-runtime-promotion.sh
```

The script must not create/delete/change application files. It only reports readiness.

Required before staging files:

- `apps/mobile/package.json` exists;
- one package lock strategy is identified;
- Expo config/app identifiers are visible and match Palta intent;
- Node/Expo requirements are known;
- no `.env`, signing certificate, private key, keystore, provisioning profile or provider credential is accidentally included;
- `node_modules`, `.expo` and generated build artifacts are excluded;
- current local changes are understood before any copy/merge operation.

## Phase 2 — choose committed boundaries

Normally commit:

- application TypeScript/TSX source;
- `package.json`;
- selected lockfile;
- safe Expo config;
- assets that belong to the app;
- public `.env.example` only;
- native config files only when intentionally source-controlled and reviewed.

Never commit:

- `.env` / `.env.local` / private environment files;
- Supabase secret/service-role keys;
- database owner URL/password;
- Transbank/Getnet/Mercado Pago private credentials;
- SII certificate/private-key material;
- Apple signing certificates/provisioning material;
- Android signing keystores/password files;
- `node_modules`;
- build outputs/caches.

## Phase 3 — reproducibility gate

After safe application source is committed on an integration branch:

1. clone/checkout the branch into a clean directory;
2. install dependencies from the committed manifest/lockfile;
3. apply only documented public LOCAL configuration;
4. start Palta mock/dev API;
5. build and launch iOS native Development Build;
6. verify Home, Neighborhood, Community, Market, Play navigation;
7. verify map route and Back/return state;
8. verify no missing source is copied from another untracked local directory;
9. repeat Android native build before beta.

A build that succeeds only on the original Mac working tree is not sufficient.

## Phase 4 — backend binding

Only after the app is reproducible:

- set `EXPO_PUBLIC_PALTA_API_BASE_URL` to the correct environment;
- bind Supabase Auth using publishable credentials only;
- keep business/payment/fiscal mutations behind Palta API;
- connect DEV Postgres/R2/Queues after those resources are provisioned;
- do not let a mobile-supplied environment string select production secrets.

## Phase 5 — retire parallel runtime behavior

Once `apps/mobile` is canonical:

- normal app startup must use committed `apps/mobile` files directly;
- recovery scripts may restore known-good files only as an explicit repair operation;
- new feature branches must modify the canonical app or merge through a controlled integration branch, not add another overlay application;
- `mobile-overlay` may remain as migration/reference material until no longer needed, but it is not a second product tree.

## Acceptance status

As of 2026-09-17:

- existing local `apps/mobile`: OBSERVED INDIRECTLY through simulator script contract and prior runtime use;
- GitHub `apps/mobile`: NOT PRESENT;
- reproducible fresh-checkout native build: NOT VERIFIED;
- DEV Supabase project: NOT PROVISIONED;
- DEV Cloudflare API/Hyperdrive/Queues resource IDs: NOT RECORDED;
- payment provider sandbox credentials: NOT ACQUIRED.

Do not mark any of the above PASS until separately verified.
