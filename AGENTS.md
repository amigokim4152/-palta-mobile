# Somos Palta branch handoff

This branch is a feature/Core Source of Truth, **not** the whole-app mobile runtime.

Before changing mobile-visible behavior, read:

```bash
git fetch origin
git show origin/main:AGENTS.md
git show origin/integration/runtime-composition-v1:docs/MOBILE_RUNTIME_COMPOSITION.md
git show origin/integration/runtime-composition-v1:manifest/mobile-runtime-composition.json
```

Repository-global reference: GitHub Issue #9 — `[Source of Truth] Mobile runtime composition for parallel feature work`.

Keep changes inside this workstream's owned surface/Core contracts. Do not hand-edit `apps/mobile/src`, duplicate Shared Cores, or merge feature work to `main` merely for simulator visibility. Whole-app simulator/review belongs to `integration/runtime-composition-v1`; branch advances must be integrated there or surfaced as review-required drift.
