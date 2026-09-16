# v3.0 Changelog — 2026-09-16

Purpose: harden Palta's infrastructure independence.

Added:
- provider-neutral AuthPort
- provider-neutral DatabasePort
- provider-neutral ObjectStoragePort
- provider-neutral NotificationPort
- provider-neutral EdgeRuntimePort
- provider-neutral KeyValueStorePort
- ProviderRegistry with explicit replaceability
- Supabase auth adapter template kept outside core
- provider-neutral notification → Palta deep-link routing
- read-only local machine preflight script
- explicit Provider Independence Contract

Existing provider candidates remain usable, but none is constitutional to Palta Core.
