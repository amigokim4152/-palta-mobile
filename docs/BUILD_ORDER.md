# Palta Build Order after GitHub is available

1. Import/retain Foundation contracts and this implementation staging on an integration branch only.
2. Establish app shell and routing for Home / Neighborhood / Community / Market / Play.
3. Implement shared state/context: identity, personal context, location context, claims/eligibility.
4. Implement Home Candidate contract + Home Composer + card primitives.
5. Implement Event/Care state machine + exact state return/deep-link contract.
6. Connect Local Business canonical data and Shared Map Core.
7. Complete first end-to-end loop: discover business -> action/inquiry/reservation -> waiting/status -> Home -> completion/follow-up.
8. Add public/local information and news/weather as secondary Home candidates, not filler.
9. Add Synthetic Persona regression scenarios across different comunas.
10. Add mobile runtime validation: offline/reconnect, Back state, safe area, keyboard, push/deep link, performance.

## Merge discipline

- `main` stays untouched until integration verification.
- Typecheck/test failure is FAIL.
- Environment/tooling that cannot be run is NOT VERIFIED, never PASS.
- No Foundation merge based on screenshots or static UI alone.
