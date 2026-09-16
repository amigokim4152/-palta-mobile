# Feedback Adapters v3.9

Provider-neutral core ports now exist for:

- HapticsPort
- SpeechPort

Expo adapter templates are included outside core:

- `mobile-overlay/src/adapters/expoHapticsAdapter.template.ts`
- `mobile-overlay/src/adapters/expoSpeechAdapter.template.ts`

Bootstrap now installs:

- expo-haptics
- expo-speech

These adapters are templates only.

Do not claim live capability until checked on:
- iPhone
- at least one recent Android
- one lower/mid-range Android if available

Haptic absence must never make an action ambiguous.
Speech absence must never make content inaccessible.
