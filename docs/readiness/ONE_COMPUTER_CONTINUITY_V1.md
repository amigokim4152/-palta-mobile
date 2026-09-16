# One-computer continuity plan

A single development computer must not become the only copy of Palta.

## Required copies

1. **GitHub**
   - canonical source history
   - integration branches
   - CI results
   - no private runtime secrets in commits

2. **Google Drive release archive**
   - signed-off prep ZIPs / handoff bundles
   - design/source-of-truth artifacts
   - operational documents

3. **Provider dashboards**
   - Cloudflare/Supabase/Expo configuration
   - secrets stored in provider secret stores, never copied into Drive documents

## End-of-session rule

Before stopping development for the day:

- `npm run verify`
- review `git status`
- commit meaningful completed work on integration branch
- push integration branch
- ensure no secrets were staged
- create/update a release bundle only at a meaningful checkpoint
- record any NOT VERIFIED item

## Computer loss/rebuild objective

A replacement computer should need only:

- Git
- Node.js 22+
- repository clone
- provider account login
- intentionally restored local environment values

to resume work.

No production private key should depend on a file that exists only on the development computer.
