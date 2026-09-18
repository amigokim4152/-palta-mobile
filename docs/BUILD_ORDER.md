# Palta Build Order

1. Retain Foundation/Core contracts on integration branches and compare before adding or replacing source-of-truth material.
2. Keep the app shell and routing coherent across Home / Neighborhood / Community / Market / Play.
3. Implement shared state/context: identity, personal context, location context, claims/eligibility.
4. Maintain Home Candidate contracts + Home Composer + card primitives as shared infrastructure rather than per-screen logic.
5. Maintain Event/Care state machine + exact state return/deep-link contract.
6. Connect Local Business canonical data and Shared Map Core through provider-neutral boundaries.
7. Complete end-to-end loops: discover -> act/inquire/reserve -> waiting/status -> Home -> completion/follow-up.
8. Add public/local information and news/weather as secondary Home candidates, not filler.
9. Add Synthetic Persona regression scenarios across different comunas.
10. Validate mobile runtime behavior: offline/reconnect, Back state, safe area, keyboard, push/deep link, MapLibre native build, and performance.
11. Validate Commerce/Payment/Fiscal/Printing flows as shared Commerce Core capabilities rather than isolated POS code.
12. Before any merge, run the applicable core CI, database/RLS smoke tests, and mobile quality regression.

## Merge discipline

- `main` stays untouched until integration verification and an explicit merge decision.
- Typecheck/test failure is `FAIL`.
- Environment/tooling that cannot be run is `NOT VERIFIED`, never `PASS`.
- No Foundation/Core merge based on screenshots or static UI alone.
- Concurrent integration branches must not be force-updated over newer work.
- Repository/package/app naming follows `NAMING_AND_REPOSITORY_STANDARD.md`.
