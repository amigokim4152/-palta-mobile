# Offline idempotency v2.8 — 2026-09-16

## Problem

A request can reach the server successfully while the response is lost.
If Palta blindly retries, the user may create two quote requests or two reservations.

## Rule

Every side-effecting user mutation receives one stable client mutation ID.

That same ID is used:
- on the first online request
- if the request is queued offline
- on every retry

For Care creation the preflight API sends it as:

`Idempotency-Key: <mutation-id>`

## Retry classes

Retry:
- network transport failure
- HTTP 408
- HTTP 425
- HTTP 429
- HTTP 5xx

Do not blindly retry:
- validation 4xx
- authorization 4xx
- unsupported mutation kind
- malformed persisted payload

## Current scope

Implemented first for Local Business quote → Care creation.

The mock API now proves repeated POSTs with the same key return the same Care ID.
Production persistence for idempotency keys belongs on the Palta API/server side.
