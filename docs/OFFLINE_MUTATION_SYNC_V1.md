# Offline mutation sync v1 — 2026-09-16

## Goal

A weak connection must not make the user repeat an action.

## Queue contract

Every queued mutation stores:
- stable mutation ID
- operation kind
- payload
- created/updated time
- attempts
- state
- last error

## Sync states

`pending → syncing → success/remove`

Failures:
- retryable → `failed_retryable`
- permanent validation/authorization failure → `failed_terminal`

## Ordering

Pending user actions are replayed in creation order.

## Retry

A retry limit prevents infinite retry loops.
Exceeding the limit converts the mutation to terminal failure for user review.

## Mobile persistence

The real Expo implementation should use SQLite through the `MutationQueueStore` port.

The in-memory store in core exists only for deterministic testing. It is not production persistence.
