import { PaymentProviderOperationError } from '../../payment/paymentIncident.js';
import type { PaymentStatus } from '../../payment/paymentModel.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
  ReconcilePaymentInput,
  RefundInput,
} from '../../ports/paymentPort.js';

export type TransbankTransportKind =
  | 'serial_sdk'
  | 'smartpos_app'
  | 'cloud_to_cloud';

export type TransbankTransportStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'reversed'
  | 'cancelled'
  | 'refunded'
  | 'error'
  | 'unknown';

export type TransbankTransportResult = {
  reference: string;
  status: TransbankTransportStatus;
  paymentId?: string;
  authorizationCode?: string;
  responseCode?: string;
  /** Provider-confirmed amount actually processed when transport exposes it. */
  amountPesos?: number;
};

export interface TransbankPosTransport {
  readonly kind: TransbankTransportKind;
  readonly supportsRefund: boolean;
  sale(input: {
    terminalId?: string;
    amountPesos: number;
    ticketNumber: string;
    idempotencyKey: string;
  }): Promise<TransbankTransportResult>;
  status(reference: string): Promise<TransbankTransportResult>;
  /**
   * Required for robust response-loss recovery on transports such as serial POS
   * Integrado, where the POS may have charged successfully before the caja lost
   * the response. Implementations should use the provider-supported recovery
   * primitive (for example Última Venta + ticket comparison) instead of blindly
   * issuing a second sale.
   */
  reconcileSale?(input: {
    reference?: string;
    terminalId?: string;
    amountPesos: number;
    ticketNumber: string;
    idempotencyKey: string;
  }): Promise<TransbankTransportResult>;
  refund?(input: {
    reference: string;
    paymentId?: string;
    amountPesos?: number;
    idempotencyKey: string;
  }): Promise<TransbankTransportResult>;
}

export function mapTransbankTransportStatus(
  status: TransbankTransportStatus,
): PaymentStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'approved':
      return 'paid';
    case 'rejected':
      return 'declined';
    case 'reversed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'error':
      return 'failed';
    case 'unknown':
      return 'unknown';
  }
}

function assertClp(amountMinor: number, currency: string): number {
  if (currency !== 'CLP') throw new Error('Transbank POS adapter currently accepts CLP only.');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Transbank POS amount must be a positive integer CLP amount.');
  }
  return amountMinor;
}

function ticketNumber(canonicalPaymentId: string): string {
  const value = canonicalPaymentId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 20);
  if (!value) throw new Error('Canonical payment ID cannot produce a Transbank ticket number.');
  return value;
}

function providerResult(result: TransbankTransportResult): ProviderPaymentStatus {
  const status = mapTransbankTransportStatus(result.status);
  const mapped: ProviderPaymentStatus = {
    providerKey: 'transbank_pos_integrated',
    providerReference: result.reference,
    status,
    providerStatus: result.status,
  };
  if (result.paymentId !== undefined) mapped.providerPaymentId = result.paymentId;
  if (result.authorizationCode !== undefined) mapped.authorizationCode = result.authorizationCode;
  if (result.responseCode !== undefined) mapped.providerStatusDetail = result.responseCode;
  if (status === 'paid' && result.amountPesos !== undefined) {
    mapped.processedAmount = {
      currency: 'CLP',
      amountMinor: assertClp(result.amountPesos, 'CLP'),
    };
  }
  return mapped;
}

export class TransbankPosIntegratedAdapter implements PaymentPort {
  readonly providerKey = 'transbank_pos_integrated';

  constructor(private readonly transport: TransbankPosTransport) {}

  supportsRail(rail: CreatePaymentInput['rail']): boolean {
    return rail === 'card' || rail === 'wallet';
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.supportsRail(input.rail)) {
      throw new Error(`Transbank POS does not support canonical rail: ${input.rail}`);
    }
    let result: TransbankTransportResult;
    try {
      result = await this.transport.sale({
        ...(input.terminalId === undefined ? {} : { terminalId: input.terminalId }),
        amountPesos: assertClp(input.amount.amountMinor, input.amount.currency),
        ticketNumber: ticketNumber(input.canonicalPaymentId),
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (error instanceof PaymentProviderOperationError) throw error;
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'outcome_unknown',
        message: 'Transbank sale response was lost or transport failed; reconcile the terminal sale before another charge.',
      });
    }
    return providerResult(result);
  }

  async getStatus(providerReference: string): Promise<ProviderPaymentStatus> {
    try {
      return providerResult(await this.transport.status(providerReference));
    } catch (error) {
      if (error instanceof PaymentProviderOperationError) throw error;
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'transient_provider_error',
        message: 'Transbank status lookup failed; retry the same lookup with backoff.',
      });
    }
  }

  async reconcilePayment(input: ReconcilePaymentInput): Promise<ProviderPaymentStatus> {
    if (this.transport.reconcileSale) {
      return providerResult(
        await this.transport.reconcileSale({
          ...(input.providerReference === undefined ? {} : { reference: input.providerReference }),
          ...(input.terminalId === undefined ? {} : { terminalId: input.terminalId }),
          amountPesos: assertClp(input.amount.amountMinor, input.amount.currency),
          ticketNumber: ticketNumber(input.canonicalPaymentId),
          idempotencyKey: input.idempotencyKey,
        }),
      );
    }
    if (input.providerReference) return this.getStatus(input.providerReference);

    throw new PaymentProviderOperationError({
      providerKey: this.providerKey,
      incidentKind: 'outcome_unknown',
      message: `Transbank transport ${this.transport.kind} cannot safely reconcile a response-loss sale without provider reference.`,
    });
  }

  async refund(input: RefundInput): Promise<ProviderPaymentStatus> {
    if (!this.transport.supportsRefund || !this.transport.refund) {
      throw new Error(`Transbank transport ${this.transport.kind} does not support refund through this adapter.`);
    }
    let result: TransbankTransportResult;
    try {
      result = await this.transport.refund({
        reference: input.providerReference,
        ...(input.providerPaymentId === undefined ? {} : { paymentId: input.providerPaymentId }),
        ...(input.amount === undefined
          ? {}
          : { amountPesos: assertClp(input.amount.amountMinor, input.amount.currency) }),
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (error instanceof PaymentProviderOperationError) throw error;
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'refund_unknown',
        message: 'Transbank refund/anulación outcome is unknown; reconcile before retrying.',
      });
    }
    return providerResult(result);
  }
}
