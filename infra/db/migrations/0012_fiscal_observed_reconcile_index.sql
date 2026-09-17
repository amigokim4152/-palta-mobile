-- PALTA FISCAL OBSERVED RECONCILIATION INDEX
-- STATUS: PRE-DEPLOYMENT / VERIFIED BY CI
-- Date: 2026-09-17
--
-- SII/provider 'observed' is not terminal. Keep it in the worker's reconcile
-- scan until it becomes accepted/rejected or requires explicit operator action.

drop index if exists public.fiscal_execution_provider_reconcile_idx;

create index fiscal_execution_provider_reconcile_idx
  on public.fiscal_execution(provider_key, status, updated_at)
  where mode = 'external_provider'
    and status in (
      'submitting',
      'queued',
      'issued',
      'pending_authority',
      'observed',
      'unknown'
    );
