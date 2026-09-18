# Palta Repository Rename Runbook

Canonical target repository: `amigokim4152/palta-mobile`

Current legacy repository name: `amigokim4152/-palta-mobile`

The repository must be renamed in place. Do not create a replacement repository and do not rewrite branch history.

## 1. GitHub repository rename

In GitHub:

1. Open the existing repository.
2. Open `Settings` -> `General`.
3. Change Repository name from `-palta-mobile` to `palta-mobile`.
4. Confirm the rename.

Afterward verify:

- the repository opens as `amigokim4152/palta-mobile`;
- `main` still exists;
- all `integration/*` branches remain present;
- commit history and Actions history remain attached to the same repository;
- visibility and permissions did not change.

## 2. Local Mac remote

From the local clone, first inspect the current remote:

```bash
git remote -v
```

Then set the canonical origin:

```bash
git remote set-url origin https://github.com/amigokim4152/palta-mobile.git
git remote -v
git fetch --all --prune
```

Do not reclone solely because the repository was renamed.

## 3. Canonical package/app identity

These values must remain stable:

```text
npm package: palta-mobile
app display name: Palta
Expo slug: palta
Expo scheme: palta
iOS bundle identifier: cl.somospalta.app
Android application ID: cl.somospalta.app
```

A GitHub repository rename does not justify changing bundle IDs, application IDs, OAuth client identities, or deep-link schemes.

## 4. CI verification

Push or update an `integration/*` branch and verify both Palta CI workflows.

Minimum checks:

```bash
npm ci
npm run verify
```

Where database preflight is configured, PostgreSQL migration/RLS smoke tests must also pass.

## 5. External integrations

Check integrations that may store the GitHub owner/repository slug rather than the stable repository ID:

- Vercel / deployment projects
- Cloudflare build/deployment integration
- Sentry source-code integration
- Expo/EAS Git metadata if configured
- GitHub webhooks or external CI
- documentation or scripts containing an absolute GitHub repository path

If no integration exists yet, record it as `NOT CONFIGURED`; do not create one solely for the rename.

## 6. Auth and callbacks

Review, but do not automatically change:

- Apple Sign In configuration
- Google OAuth configuration
- Supabase Auth redirect URLs
- universal links / associated domains
- Android app links
- callback URLs that explicitly contain a GitHub repository URL

Only repository-slug-dependent values should change. `cl.somospalta.app` and the `palta` deep-link scheme stay unchanged.

## 7. Legacy identifier cleanup

In active code/configuration, remove current-product uses of:

- `NAREVU`
- `Chile-K`
- `palta-app-prep-*`
- Base44 as a current runtime/product namespace
- `amigokim4152/-palta-mobile` after the GitHub rename is complete

Historical migration/provenance documents may retain old names when they are needed to explain history.

## 8. Completion criteria

Repository normalization is complete only when all of the following are true:

- GitHub repository is `amigokim4152/palta-mobile`;
- local `origin` points to the canonical URL;
- package name is `palta-mobile`;
- mobile identifiers remain canonical;
- CI passes on the normalized branch;
- active configuration contains no stale repository slug that affects runtime/deployment;
- no new replacement repository was created;
- `main` was not changed merely to perform the rename.
