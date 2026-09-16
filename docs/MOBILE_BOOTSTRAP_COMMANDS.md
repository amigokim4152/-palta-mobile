# Mobile Bootstrap Commands — run only after GitHub integration branch is ready

These commands are staging instructions, not yet executed in the Palta repository.

## 1. Create/attach Expo SDK 57 shell

If the repository does **not** already contain a native mobile shell:

```bash
npx create-expo-app@latest palta-mobile
# When prompted, select SDK 57 / default TypeScript multi-screen template.
```

If the repository already has a React Native/Expo shell, do not create a second app. Inspect and adapt the existing runtime instead.

## 2. Verify baseline before Palta code

```bash
cd palta-mobile
npx expo-doctor
npx expo start
```

First verification: app shell launches and five primary surfaces can be routed without MapLibre.

## 3. Development build before MapLibre

Palta must use a development build once native modules are introduced. Expo Go is not the MapLibre test environment.

```bash
npx expo install expo-dev-client
```

Then create the platform build using the selected local/EAS path. EAS is optional infrastructure, not a Foundation dependency.

## 4. MapLibre

After the shell is verified:

```bash
npx expo install @maplibre/maplibre-react-native
```

Add `@maplibre/maplibre-react-native` to the Expo config plugins, then rebuild the native development client.

Do not let Business, Property, Mobility, or Events initialize separate MapLibre instances as their own map engines. They must consume Shared Map Core.

## 5. Persistence modules when needed

```bash
npx expo install expo-sqlite expo-secure-store expo-location expo-notifications
```

Use SQLite for durable cache/offline/state-return data; SecureStore only for small sensitive session/token material.

## 6. Verification order

```text
shell/navigation
-> state return
-> current/exploring location behavior
-> local cache/reconnect
-> Shared Map Core
-> canonical Business layer
-> first vertical slice
-> Push/deep-link exact state return
-> real-device performance/accessibility regression
```

Never call an item PASS because it compiles. Native behavior needs device verification.
