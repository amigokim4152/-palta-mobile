# GitHub Repository Checklist

Use this order. Do not improvise across concurrent Palta integration branches.

1. Fetch `main`; confirm it is still the minimal baseline and record SHA.
2. Fetch the integration branch being worked on; record SHA and tree before changes.
3. Do not merge `main` without an explicit verified merge decision.
4. Compare existing files before adding anything; do not duplicate Foundation/Core source-of-truth material.
5. Use `palta-mobile` as the repository/package identity. Do not introduce `palta-app-prep-*` as a current identifier.
6. Clean-install dependencies in a CI-capable environment.
7. Run typecheck, core tests, provider-independence checks, and database preflight where applicable. Environment failure = `NOT VERIFIED`.
8. Keep Expo/native runtime work separated from provider-neutral core contracts.
9. Verify the app shell on a real iOS/Android development build before treating native MapLibre behavior as verified. Expo Go is not a valid MapLibre verification environment.
10. Preserve canonical mobile identifiers: `Palta`, `palta`, and `cl.somospalta.app`.
11. After the GitHub repository is renamed from `-palta-mobile` to `palta-mobile`, follow `REPOSITORY_RENAME_RUNBOOK.md` and verify local remotes, CI, deployment integrations, callbacks, and repository references.
12. Run Foundation + mobile quality regression before any merge decision.

## Merge discipline

- `main` stays untouched until integration verification and an explicit merge decision.
- Typecheck/test failure is `FAIL`.
- Environment/tooling that cannot be run is `NOT VERIFIED`, never `PASS`.
- Do not use screenshots or static UI alone as evidence that Foundation/Core integration is correct.
