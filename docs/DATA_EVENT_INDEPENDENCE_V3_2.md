# Data / Event Independence v3.2

## Event Core

Palta events are defined by `EventBusPort`, not by Cloudflare Queues, Supabase Realtime, Kafka, SNS or any other provider.

Examples:
- `care.updated`
- `canonical.changed`
- `notification.candidate`
- `live.transit`
- `live.weather`
- `live.disaster`

A provider may transport them, but event type, subject reference, dedupe key and payload remain Palta contracts.

## Asset references

Canonical records must not store infrastructure URLs as identity.

Use provider-neutral:
- `assetId`
- `logicalKey`
- hash/version metadata

A delivery URL can change without changing the canonical object.

## Data releases

Every static/bulk release gets:
- release ID
- dataset
- country
- schema version
- file hashes
- byte sizes
- previous release reference

This allows the same release to live on:
- R2
- S3-compatible storage
- local disk
- another CDN

without changing the app-facing release identity.

## Cost guard

Provider free tiers are operational choices.

Usage states:
- <70% OK
- 70% warning
- 85% optimize / secondary readiness
- 95% paid/failover decision
- 100% over limit

The thresholds live in Palta operations logic, not inside provider dashboards.
