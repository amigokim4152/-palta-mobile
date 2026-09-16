# Supabase Access Model v1 — 2026-09-16

Status: DRAFT / NOT APPLIED

## Decision

Supabase remains the primary v1 operational DB/Auth candidate, but the mobile app does not get blanket CRUD access to all `public` tables.

### Public canonical data
Client-readable:
- canonical entities
- places
- businesses

Client mutation:
- none in v1

### Private personal data
Client-readable only for the signed-in user:
- Care tracks
- Home candidates

Direct client mutation:
- intentionally disabled in the preflight policy

Side-effecting operations (quote, reservation, provider contact, notification-affecting state) go through the Palta API.

## Three-layer access model

1. `GRANT`: can the Postgres role reach the object?
2. RLS: which rows can it read?
3. Palta API authorization: is the side effect allowed?

`TO authenticated` alone is not authorization.

## 2026 Supabase compatibility

New tables must not rely on implicit Data API exposure. Explicit grants and RLS belong in the same migration.

## Auth metadata rule

Never authorize from user-editable `user_metadata`.
Sensitive operator/admin/business permissions must come from server-controlled truth.

## Service key rule

`service_role` / secret keys never ship in Expo or public clients.
