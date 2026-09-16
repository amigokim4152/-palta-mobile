# GitHub Home Checklist

When GitHub access is working again, do not improvise. Use this order.

1. Fetch `main`; confirm it is still the minimal baseline and record SHA.
2. Fetch `integration/foundation-authorization-policy-v1`; record SHA and tree before changes.
3. Do not merge `main`.
4. Add/compare the Foundation freeze candidate first; do not duplicate files already present.
5. Add this `palta-app-prep-v1` staging under an implementation/core location appropriate to the repository, not as a second source-of-truth Foundation.
6. Clean install dependencies in CI-capable environment.
7. Run typecheck and core tests. Environment failure = NOT VERIFIED.
8. Only then bootstrap Expo SDK 57 native shell if the repo does not already have a conflicting mobile runtime.
9. Run app shell on a real iOS/Android development build before MapLibre integration.
10. Add MapLibre through its Expo config plugin and re-build native development client; Expo Go is not a valid MapLibre verification environment.
11. Implement the first Local Business vertical slice from `FIRST_VERTICAL_SLICE.md`.
12. Run Foundation + mobile quality regression before any merge decision.
