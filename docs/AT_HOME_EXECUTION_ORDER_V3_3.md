# At-home execution order v3.3

The goal is to avoid improvisation.

## Phase 0 — read-only checks

```bash
bash scripts/preflight-local.sh
bash scripts/inventory-local-assets.sh
```

No writes.

## Phase 1 — Git branch safety

After GitHub reconnect:

```bash
bash scripts/repo-safety-check.sh
```

PASS requires:
- inside the correct repository
- branch starts with `integration/`
- not `main`
- clean working tree

## Phase 2 — existing assets first

Before creating anything:
- inspect `/Users/user/palta-data`
- locate existing Santiago PMTiles
- locate prior Worker/R2 config
- inventory Cloudflare account
- verify whether the old map asset is reusable

Do not create a duplicate bucket or map build.

## Phase 3 — mobile shell

Only if no mobile shell exists:

```bash
bash scripts/bootstrap-mobile.sh
```

The script:
- refuses main/master
- refuses dirty tree
- creates `apps/mobile`
- installs Expo-compatible packages through `expo install`
- does not copy Palta overlay automatically
- does not commit or push

## Phase 4 — overlay review/copy

Compare:
- `mobile-overlay/`
- real `apps/mobile/`

Copy intentionally, then run typecheck.

## Phase 5 — Cloudflare map validation

Bind the **existing** R2 bucket in the Worker template, deploy to non-production/preflight route, then:

```bash
node infra/cloudflare/scripts/verify-map-range.mjs https://<preflight-host>
```

Do not point production app to it until Range verification passes.

## Phase 6 — Supabase development project

Only after mobile/API boundary is stable:
- create dev project
- use publishable key in mobile
- keep secret/service keys server-side
- apply schema/RLS to dev only
- test real user isolation

## Phase 7 — final integration readiness

```bash
bash scripts/verify-integration-ready.sh
```

Only then consider a commit on the integration branch.

No main merge without explicit approval.
