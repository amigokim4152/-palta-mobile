import type { PaymentStatus } from '../../payment/paymentModel.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
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

function providerResult(result: TransbankTransportResult): ProviderPaymentStatus {
  const mapped: ProviderPaymentStatus = {
    providerKey: 'transbank_pos_integrated',
    providerReference: result.reference,
    status: mapTransbankTransportStatus(result.status),
    providerStatus: result.status,
  };
  if (result.paymentId !== undefined) mapped.providerPaymentId = result.paymentId;
  if (result.responseCode !== undefined) mapped.providerStatusDetail = result.responseCode;
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
    const result = await this.transport.sale({
      ...(input.terminalId === undefined ? {} : { terminalId: input.terminalId }),
      amountPesos: assertClp(input.amount.amountMinor, input.amount.currency),
      ticketNumber: input.canonicalPaymentId.slice(0, 20),
      idempotencyKey: input.idempotencyKey,
    });
    return providerResult(result);
  }

  async getStatus(providerReference: string): Promise<ProviderPaymentStatus> {
    return providerResult(await this.transport.status(providerReference));
  }

  async refund(input: RefundInput): Promise<ProviderPaymentStatus> {
    if (!this.transport.supportsRefund || !this.transport.refund) {
      throw new Error(`Transbank transport ${this.transport.kind} does not support refund through this adapter.`);
    }
    const result = await this.transport.refund({
      reference: input.providerReference,
      ...(input.providerPaymentId === undefined ? {} : { paymentId: input.providerPaymentId }),
      ...(input.amount === undefined
        ? {}
        : { amountPesos: assertClp(input.amount.amountMinor, input.amount.currency) }),
      idempotencyKey: input.idempotencyKey,
    });
    return providerResult(result);
  }
}
