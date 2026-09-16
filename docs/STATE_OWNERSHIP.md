# State Ownership v1

Palta must avoid one global store becoming a second database.

| State | Owner | Mobile behavior |
|---|---|---|
| Canonical Business/Place/Public objects | Palta canonical API/data release | cache locally; never fork as UI-owned truth |
| Personal profile/claims/relationships | Personal/Identity Core | local cache is a projection; mutations sync through authorized API |
| CareTrack/Event state | Care/Event Core | persist enough locally for fast return/offline continuity; server remains canonical after sync |
| Home composition | Home Composer projection | recomputable; do not persist as independent truth beyond cache |
| Map viewport/filter/scroll | device UI state | local/session persistence only |
| Exploring location | device/user session context | never auto-promote to confirmed life area |
| Auth/session secret | auth provider + secure device storage | only minimal token/session material in secure storage |
| Public release data | Data Factory/R2/API | stale-while-refresh/local cache allowed with freshness metadata |

## Offline write rule

A user action must have an explicit state:

`LOCAL_PENDING -> SYNCING -> CONFIRMED | FAILED_RETRYABLE | FAILED_FINAL`

Never show a server-confirmed success merely because the local tap succeeded.

## Recovery rule

Retryable network failure keeps the user's intent and input. The user should not have to reconstruct the same action after reconnect.
