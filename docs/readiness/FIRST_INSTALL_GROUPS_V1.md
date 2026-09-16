# First-install groups

## Install now — required

### Development base
- Git
- Node.js 22+
- npm/npx
- VS Code (recommended)
- GitHub authentication

### macOS, before native iOS work
- Xcode Command Line Tools
- Full Xcode when simulator/native build starts

## Install after repository/Core PASS

### Mobile
- Expo dependencies through project bootstrap
- MapLibre React Native
- Expo Router
- SecureStore
- SQLite
- Location
- Notifications
- Haptics
- Speech

The bootstrap script installs project dependencies consistently. Do not install these globally one by one.

## Install only when used

### Cloudflare phase
- Wrangler

### Supabase phase
- Supabase CLI only if local migrations/dev workflow requires it

### EAS phase
- EAS CLI

### Android native phase
- Android Studio / SDK / emulator
- required JDK

## Never install/store as ordinary local files
- production service-role keys
- payment private access tokens
- webhook secrets
- signing keys

Use provider secret stores and local ignored development environment files.
