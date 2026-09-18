# Somos Palta branch handoff

This branch is a feature/Core Source of Truth, **not** the whole-app mobile runtime.

Before changing mobile-visible behavior, read the repository-wide contract:

```bash
git fetch origin
git show origin/main:AGENTS.md
git show origin/integration/runtime-composition-v1:docs/MOBILE_RUNTIME_COMPOSITION.md
git show origin/integration/runtime-composition-v1:manifest/mobile-runtime-composition.json
```

Repository-global reference: GitHub Issue #9 — `[Source of Truth] Mobile runtime composition for parallel feature work`.

Rules:
- inspect this branch's current implementation first; do not duplicate existing work;
- change only this workstream's owned surface/Core contracts;
- do not hand-edit `apps/mobile/src` as Source of Truth;
- do not duplicate Shared Cores;
- whole-app simulator/review belongs to `integration/runtime-composition-v1`;
- when this branch advances, the composition runtime must either integrate it or surface review-required drift;
- do not merge feature work to `main` merely to make it visible in the simulator.
