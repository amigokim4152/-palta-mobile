# Palta blocker recovery matrix

| Blocker | Continue with | Do not do |
|---|---|---|
| GitHub write permission unavailable | local verified commit/bundle | touch `main` or claim push succeeded |
| Supabase not created | mock API + canonical ports | hard-code temporary DB calls into UI |
| Cloudflare unavailable | local mock Worker/API | move provider logic into mobile core |
| R2 unavailable | local fixture/object adapter | embed large production assets in app |
| Transport/API credentials pending | static verified snapshots | fabricate live data |
| Payment account unavailable | fake provider implementing PaymentPort | store fake PSP assumptions in canonical model |
| Expo/EAS unavailable | Core tests/reference code | mark native behavior PASS |
| iPhone/Android not available | syntax/policy tests | claim device UX/haptics/TTS verified |
| Partner API unavailable | information/deep-link capability | redesign Partner Core around one vendor |

## Rule

A blocker changes the verification state, not the architecture.
