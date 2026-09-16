# Palta local mock API

Zero external dependencies. Requires Node 22+.

Run:

```bash
node dev/mock-api/server.mjs
```

In another shell:

```bash
node dev/mock-api/smoke.mjs
```

Expo development config can use:

```env
EXPO_PUBLIC_PALTA_API_BASE_URL=http://<LAN_IP>:8787
```

Use the Mac LAN IP for a physical iPhone. `localhost` on the phone is the phone itself.

This server is development-only:
- no real auth
- no persistence
- no provider calls
- no production secrets
