# At-computer UI check v3.8

After the repository/mobile shell is ready:

1. Apply the v3.8 overlay on the integration branch only.
2. Install mobile dependencies.
3. Start an Expo development build.
4. Open `/reference/home`.
5. Compare Normal / Large / Accessibility.
6. Change the OS text size and confirm the production Home responds.
7. Open `/reference/reading`.
8. Test portrait on:
   - small Android size
   - regular Android
   - iPhone
9. Check:
   - text clipping
   - button wrapping
   - list-row overflow
   - glance reflow
   - sheet geometry
   - safe areas
10. Only after the visual reference is acceptable, wire native haptic and TTS adapters.

Do not merge to main from this check.
