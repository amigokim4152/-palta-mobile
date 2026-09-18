# Somos Palta parallel-work entry point

This branch is the whole-app mobile runtime composition branch.

Before changing any mobile-visible behavior, read:

- `docs/MOBILE_RUNTIME_COMPOSITION.md`
- `manifest/mobile-runtime-composition.json`
- repository-global GitHub Issue #9: `[Source of Truth] Mobile runtime composition for parallel feature work`

Repository-wide rules also live in `AGENTS.md` on `main`.

Key rules:

- Feature branches remain Sources of Truth for their own surfaces/contracts.
- Whole-app simulator/review happens on `integration/runtime-composition-v1`.
- Do not hand-edit `apps/mobile/src` as Source of Truth; it is generated runtime output.
- Do not duplicate Shared Cores inside feature branches.
- Integrate isolated screens as declared overlays only; reconcile shared API/Core changes first.
- Any source advance that cannot be safely overlaid must be surfaced as review-required rather than silently showing stale UI.
- Whole-app acceptance requires composed runtime typecheck and iOS bundle verification.
- Do not merge feature work to `main` merely to make it visible in the simulator.
