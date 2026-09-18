# Palta Source of Truth — implementation references

This staging package does not replace the authoritative Somos Palta Drive documents.

Authoritative inputs used for this handoff:

- Foundation freeze candidate: `00_Foundation/palta-foundation-v1-freeze-candidate.zip` — 16 files.
- `Palta Product Core – Master Spec` — Drive ID `1UBqLyvfMNMutC94UT_0VwAPjXWIAYEFok1dC1quq6Dc`.
- `PALTA Experience Foundation v1` — Drive ID `1epRduXBVDcZrP7LcVVDkWC1hgJ-Q8Fz2sjx_a03dTw8`.
- `Palta Infrastructure & Operations Master — Provider·Backup·Failover·AI Moderation` — Drive ID `1rHEX3F80bDKIIv_Vx7iz5RE7JL8Yc07W3cDgTHn95zU`.
- `PALTA Synthetic Personas & Locality QA v1` — Drive ID `1QCUlWu3Z2me5YXSNNlUtjDGzuOixMMlyCBZWFPDpx5A`.

Implementation precedence when wording differs:

1. Explicit current user decision.
2. Foundation contracts / freeze gates for cross-domain invariants.
3. Product Core for product behavior and surface responsibility.
4. Experience Foundation for interaction/runtime quality.
5. Infrastructure Master for provider/runtime/operations constraints.
6. This staging package as executable extraction only.

## Repository cross-domain implementation contracts

These repository documents are mandatory execution rules for feature development where applicable. Feature branches must consume them rather than recreating competing local architecture.

- `docs/LOCALIZATION_RUNTIME_V1.md` — **mandatory for every user-visible surface and every domain exposing localized data.** Language is independent from Chile region/jurisdiction; canonical data remains language-neutral; static UI copy uses shared catalogs; translations are additive presentation data; originals are preserved; events/notifications are not duplicated per language; raw technical errors are never user copy.
- `docs/DATA_SOURCE_GOVERNANCE_V1.md` — **mandatory for every collector, import, research workflow, Local Business ingestion path, public-data source, market/catalog ingestion path, and future country-layer data source.** Discovery is not canonical evidence. Third-party platforms may be discovery/research signals without being allowed canonical bulk-ingestion sources. Factual fields must be independently verified from a permitted source, provenance/rights metadata must be retained, and photos/reviews/platform prose or unclear personal contact data must not be copied into the canonical public dataset without an explicit permitted basis.
- Other domain-specific contracts in `docs/` remain authoritative for their implementation boundary unless superseded by a higher-precedence source or an explicit current user decision.

When adding a new module, developers must check relevant cross-domain contracts before creating new providers, stores, canonical enums, API fields, persistence, collection jobs, import pipelines, or presentation rules.

Do not copy large source documents into the application repository. Keep small executable contracts/tests in code and link back to the authoritative source.
