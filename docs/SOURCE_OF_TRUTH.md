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

Do not copy large source documents into the application repository. Keep small executable contracts/tests in code and link back to the authoritative source.
