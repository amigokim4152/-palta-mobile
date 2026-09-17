export type FiscalProviderIncidentKind =
  | 'validation_error'
  | 'configuration_error'
  | 'authentication_error'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'transient_provider_error'
  | 'outcome_unknown'
  | 'authority_rejected'
  | 'provider_error';

export type FiscalProviderIncident = {
  kind: FiscalProviderIncidentKind;
  retrySameOperation: boolean;
  requiresReconciliation: boolean;
  operatorActionRequired: boolean;
};

const INCIDENTS: Readonly<Record<FiscalProviderIncidentKind, FiscalProviderIncident>> = {
  validation_error: {
    kind: 'validation_error',
    retrySameOperation: false,
    requiresReconciliation: false,
    operatorActionRequired: true,
  },
  configuration_error: {
    kind: 'configuration_error',
    retrySameOperation: false,
    requiresReconciliation: false,
    operatorActionRequired: true,
  },
  authentication_error: {
    kind: 'authentication_error',
    retrySameOperation: false,
    requiresReconciliation: false,
    operatorActionRequired: true,
  },
  rate_limited: {
    kind: 'rate_limited',
    retrySameOperation: true,
    requiresReconciliation: false,
    operatorActionRequired: false,
  },
  provider_unavailable: {
    kind: 'provider_unavailable',
    retrySameOperation: true,
    requiresReconciliation: false,
    operatorActionRequired: false,
  },
  transient_provider_error: {
    kind: 'transient_provider_error',
    retrySameOperation: true,
    requiresReconciliation: false,
    operatorActionRequired: false,
  },
  outcome_unknown: {
    kind: 'outcome_unknown',
    retrySameOperation: false,
    requiresReconciliation: true,
    operatorActionRequired: false,
  },
  authority_rejected: {
    kind: 'authority_rejected',
    retrySameOperation: false,
    requiresReconciliation: false,
    operatorActionRequired: true,
  },
  provider_error: {
    kind: 'provider_error',
    retrySameOperation: false,
    requiresReconciliation: true,
    operatorActionRequired: true,
  },
};

export function fiscalProviderIncident(
  kind: FiscalProviderIncidentKind,
): FiscalProviderIncident {
  return { ...INCIDENTS[kind] };
}

export class FiscalProviderOperationError extends Error {
  readonly providerKey: string;
  readonly incident: FiscalProviderIncident;
  readonly providerCode?: string;
  readonly httpStatus?: number;

  constructor(input: {
    providerKey: string;
    incidentKind: FiscalProviderIncidentKind;
    message: string;
    providerCode?: string;
    httpStatus?: number;
  }) {
    super(input.message);
    this.name = 'FiscalProviderOperationError';
    this.providerKey = input.providerKey;
    this.incident = fiscalProviderIncident(input.incidentKind);
    if (input.providerCode !== undefined) this.providerCode = input.providerCode;
    if (input.httpStatus !== undefined) this.httpStatus = input.httpStatus;
  }
}
