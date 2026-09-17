export type ChileBoletaEmissionModel =
  | 'always_issue_boleta'
  | 'voucher_replaces_boleta_for_electronic_payment';

export type ChileBoletaEmissionModelSource =
  | 'merchant_declared'
  | 'sii_verified';

/**
 * SII emission-model choice is time-scoped. Do not store it as one timeless
 * boolean because a merchant may change the declared model for a later month.
 */
export type ChileBoletaEmissionModelRecord = {
  businessId: string;
  model: ChileBoletaEmissionModel;
  /** Calendar month in Chile, YYYY-MM. */
  effectiveMonth: string;
  source: ChileBoletaEmissionModelSource;
  recordedAt: string;
};

export type ChilePaymentDocumentationKind =
  | 'cash'
  | 'bank_transfer'
  | 'electronic_voucher_eligible'
  | 'other_non_electronic';

export type ChileBoletaEmissionDecision =
  | {
      action: 'issue_boleta';
      customerRepresentation: 'boleta';
      reason: 'non_electronic_payment_requires_boleta';
    }
  | {
      action: 'issue_boleta';
      customerRepresentation: 'boleta_and_payment_voucher';
      reason: 'merchant_declared_always_issue_boleta';
    }
  | {
      action: 'do_not_issue_boleta';
      customerRepresentation: 'payment_voucher';
      reason: 'declared_voucher_replaces_boleta';
    }
  | {
      action: 'requires_configuration';
      customerRepresentation: 'payment_voucher';
      reason: 'electronic_payment_emission_model_unknown';
    };

function assertMonth(value: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error('Chile boleta emission effectiveMonth must use YYYY-MM.');
  }
}

function chileCalendarMonth(occurredAt: string): string {
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Chile boleta emission occurredAt must be a valid timestamp.');
  }
  // Fiscal orchestration should pass a Santiago-local timestamp with offset. The
  // calendar date in the supplied ISO string is therefore authoritative here;
  // do not silently recalculate it using the server's timezone.
  const match = /^(\d{4})-(\d{2})-\d{2}T/.exec(occurredAt);
  if (!match) throw new Error('Chile boleta emission occurredAt must be ISO-8601 with calendar date.');
  return `${match[1]}-${match[2]}`;
}

export function validateChileBoletaEmissionModelRecord(
  record: ChileBoletaEmissionModelRecord,
): void {
  if (!record.businessId.trim()) throw new Error('Chile boleta emission model requires businessId.');
  assertMonth(record.effectiveMonth);
  if (Number.isNaN(Date.parse(record.recordedAt))) {
    throw new Error('Chile boleta emission model recordedAt must be a valid timestamp.');
  }
}

export function modelForChileTransaction(input: {
  businessId: string;
  occurredAt: string;
  records: readonly ChileBoletaEmissionModelRecord[];
}): ChileBoletaEmissionModelRecord | null {
  const month = chileCalendarMonth(input.occurredAt);
  const matches = input.records.filter((record) => {
    validateChileBoletaEmissionModelRecord(record);
    return record.businessId === input.businessId && record.effectiveMonth === month;
  });
  if (matches.length > 1) {
    throw new Error('More than one Chile boleta emission model exists for the same business/month.');
  }
  return matches[0] ?? null;
}

/**
 * Determines whether Palta should create a consumer boleta for a sale.
 *
 * This policy is intentionally independent from payment success. A payment may
 * already be canonical `paid` while Fiscal Core still needs merchant emission
 * configuration. Missing configuration must never cause a replacement charge or
 * roll back the payment.
 *
 * Scope: consumer boletas. Factura issuance is a separate fiscal path.
 */
export function decideChileBoletaEmission(input: {
  businessId: string;
  occurredAt: string;
  paymentKind: ChilePaymentDocumentationKind;
  modelRecords: readonly ChileBoletaEmissionModelRecord[];
}): ChileBoletaEmissionDecision {
  if (!input.businessId.trim()) throw new Error('Chile boleta decision requires businessId.');

  if (
    input.paymentKind === 'cash' ||
    input.paymentKind === 'bank_transfer' ||
    input.paymentKind === 'other_non_electronic'
  ) {
    return {
      action: 'issue_boleta',
      customerRepresentation: 'boleta',
      reason: 'non_electronic_payment_requires_boleta',
    };
  }

  const model = modelForChileTransaction({
    businessId: input.businessId,
    occurredAt: input.occurredAt,
    records: input.modelRecords,
  });
  if (!model) {
    return {
      action: 'requires_configuration',
      customerRepresentation: 'payment_voucher',
      reason: 'electronic_payment_emission_model_unknown',
    };
  }
  if (model.model === 'always_issue_boleta') {
    return {
      action: 'issue_boleta',
      customerRepresentation: 'boleta_and_payment_voucher',
      reason: 'merchant_declared_always_issue_boleta',
    };
  }
  return {
    action: 'do_not_issue_boleta',
    customerRepresentation: 'payment_voucher',
    reason: 'declared_voucher_replaces_boleta',
  };
}
