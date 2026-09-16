# Auth, Access & Notification v3.1

## Authentication

Palta Core depends only on `AuthPort`.

A concrete provider adapter may be:
- Supabase Auth
- Clerk
- OIDC/custom

`PaltaApiClient` receives its bearer token from `AuthPort`; it does not know which provider created the token.

## Public vs private surfaces

Initial rule:
- Home: authenticated
- Care detail: authenticated
- Settings: authenticated
- Neighborhood: optional auth
- Community: optional auth at surface level; individual private groups may require membership
- Market: optional auth for browse; actions may require sign-in
- Play: optional auth
- Business/Place detail: public
- Public search: public

This preserves public-web/guest access while keeping Personal Home private.

## Notifications

Palta owns the notification envelope and deep-link target.

Expo/OneSignal/APNs/FCM only transport the message.

Provider device tokens are delivery endpoints, not user identity.

## Independence gate

`npm run check:independence`

fails if Palta core imports provider SDKs or contains provider secret patterns.
