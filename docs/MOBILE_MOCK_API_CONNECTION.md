# Mobile → Mock API connection — v2.5

## What changed

Home, Neighborhood, Business Detail and Care Detail now load through the Palta API client instead of hardcoded mock objects.

## Development URL

On an iOS simulator, `http://127.0.0.1:8787` may be usable.

On a physical iPhone, `127.0.0.1` points to the phone itself. Use the Mac's private LAN IP:

```env
EXPO_PUBLIC_PALTA_API_BASE_URL=http://192.168.x.x:8787
EXPO_PUBLIC_ENV=development
```

The runtime guard allows HTTP only for localhost/private-LAN addresses in `development`. Preview/production still require HTTPS.

## Location

Neighborhood no longer assumes Vitacura as user truth.

Until Location Core is connected:
- production has no fake location fallback
- development exposes an explicit test-location action
- exploring a map area never rewrites `home_area`

## Failure behavior

- loading is visible
- API error is recoverable
- stale rendered data can remain while refresh fails
- failed quote submission does not navigate to fake success
- durable offline write persistence is still NOT VERIFIED until Expo SQLite adapter is connected
