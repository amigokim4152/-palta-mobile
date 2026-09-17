import {
  assertFiscalLine,
  assertFiscalLinesMatchTotals,
  type FiscalRequest,
} from './fiscalModel.js';
import type { ExternalFiscalIssueInput } from '../../ports/chileExternalFiscalPort.js';

/**
 * Converts a canonical FiscalRequest into the provider-neutral external issuance
 * contract. No tax arithmetic is guessed here. Every line must already carry an
 * explicit net/exempt/VAT/gross decomposition produced by the Chile fiscal
 * rules/preparation layer.
 */
export function prepareExternalFiscalIssue(
  request: FiscalRequest,
): ExternalFiscalIssueInput {
  if (!request.receiver) {
    throw new Error('External fiscal issuance requires an explicit canonical receiver.');
  }
  request.lines.forEach(assertFiscalLine);
  assertFiscalLinesMatchTotals(request.lines, request.totals);

  const lines = request.lines.map((line) => {
    if (!line.unitCode?.trim()) {
      throw new Error(`Fiscal line ${line.id} requires unitCode before external issuance.`);
    }
    const unitNetAmountMinor = line.unitNetAmountMinor;
    const unitGrossAmountMinor = line.unitGrossAmountMinor;
    const lineNetAmountMinor = line.lineNetAmountMinor;
    const lineVatAmountMinor = line.lineVatAmountMinor;
    const lineTotalAmountMinor = line.lineTotalAmountMinor;
    if (
      unitNetAmountMinor === undefined ||
      unitGrossAmountMinor === undefined ||
      lineNetAmountMinor === undefined ||
      lineVatAmountMinor === undefined ||
      lineTotalAmountMinor === undefined
    ) {
      throw new Error(`Fiscal line ${line.id} tax breakdown is incomplete.`);
    }
    return {
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitCode: line.unitCode,
      unitNetAmountMinor,
      unitGrossAmountMinor,
      lineNetAmountMinor,
      lineVatAmountMinor,
      lineTotalAmountMinor,
      exempt: line.exempt,
    };
  });

  return {
    canonicalFiscalRequestId: request.id,
    businessId: request.businessId,
    issuerRut: request.issuerRut,
    documentType: request.documentType,
    idempotencyKey: request.idempotencyKey,
    receiver: { ...request.receiver },
    lines,
    totals: { ...request.totals },
    ...(request.references === undefined
      ? {}
      : { references: request.references.map((reference) => ({ ...reference })) }),
  };
}
