import type { PaymentStatus } from '../../payment/paymentModel.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
  RefundInput,
} from '../../ports/paymentPort.js';

export type JsonHttpResponse<T> = {
  status: number;
  body: T;
};

export interface JsonHttpClient {
  request<T>(input: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  }): Promise<JsonHttpResponse<T>>;
}

export type AccessTokenProvider = () => Promise<string>;

export type MercadoPagoPointOrder = {
  id: string;
  status: string;
  status_detail?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      status_detail?: string;
      amount?: string;
    }>;
    refunds?: Array<{
      id?: string;
      status?: string;
      amount?: string;
    }>;
  };
};

function firstPayment(order: MercadoPagoPointOrder) {
  return order.transactions?.payments?.[0];
}

export function mapMercadoPagoPointStatus(
  providerStatus: string,
  providerStatusDetail?: string,
): PaymentStatus {
  if (providerStatus === 'processed' && providerStatusDetail === 'partially_refunded') {
    return 'partially_refunded';
  }
  switch (providerStatus) {
    case 'created':
      return 'pending';
    case 'at_terminal':
      return 'processing';
    case 'action_required':
      return 'requires_action';
    case 'processed':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'expired':
    case 'canceled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return 'unknown';
  }
}

function externalReference(canonicalPaymentId: string): string {
  const normalized = canonicalPaymentId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
  if (!normalized) throw new Error('Canonical payment ID cannot produce a Mercado Pago external reference.');
  return normalized;
}

function clpAmount(amountMinor: number, currency: string): string {
  if (currency !== 'CLP') throw new Error('Mercado Pago Point Chile adapter currently accepts CLP only.');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Mercado Pago Point amount must be a positive integer CLP amount.');
  }
  return String(amountMinor);
}

function providerStatusResult(order: MercadoPagoPointOrder): ProviderPaymentStatus {
  const payment = firstPayment(order);
  const detail = order.status_detail ?? payment?.status_detail;
  const result: ProviderPaymentStatus = {
    providerKey: 'mercadopago_point',
    providerReference: order.id,
    status: mapMercadoPagoPointStatus(order.status, detail),
    providerStatus: order.status,
  };
  if (detail !== undefined) result.providerStatusDetail = detail;
  if (payment?.id !== undefined) result.providerPaymentId = payment.id;
  return result;
}

export class MercadoPagoPointAdapter implements PaymentPort {
  readonly providerKey = 'mercadopago_point';

  constructor(
    private readonly http: JsonHttpClient,
    private readonly accessTokenProvider: AccessTokenProvider,
    private readonly baseUrl = 'https://api.mercadopago.com',
  ) {}

  supportsRail(rail: CreatePaymentInput['rail']): boolean {
    return rail === 'card' || rail === 'wallet';
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.supportsRail(input.rail)) {
      throw new Error(`Mercado Pago Point does not support canonical rail: ${input.rail}`);
    }
    if (!input.terminalId?.trim()) {
      throw new Error('Mercado Pago Point requires terminalId.');
    }

    const token = await this.accessTokenProvider();
    const response = await this.http.request<MercadoPagoPointOrder>({
      method: 'POST',
      url: `${this.baseUrl}/v1/orders`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: {
        type: 'point',
        external_reference: externalReference(input.canonicalPaymentId),
        transactions: {
          payments: [{ amount: clpAmount(input.amount.amountMinor, input.amount.currency) }],
        },
        config: {
          point: {
            terminal_id: input.terminalId,
            print_on_terminal: 'no_ticket',
          },
        },
        ...(input.description ? { description: input.description } : {}),
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Mercado Pago Point create order failed with HTTP ${response.status}.`);
    }
    const mapped = providerStatusResult(response.body);
    const result: CreatePaymentResult = { ...mapped };
    return result;
  }

  async getStatus(providerReference: string): Promise<ProviderPaymentStatus> {
    const token = await this.accessTokenProvider();
    const response = await this.http.request<MercadoPagoPointOrder>({
      method: 'GET',
      url: `${this.baseUrl}/v1/orders/${encodeURIComponent(providerReference)}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Mercado Pago Point get order failed with HTTP ${response.status}.`);
    }
    return providerStatusResult(response.body);
  }

  async refund(input: RefundInput): Promise<ProviderPaymentStatus> {
    const token = await this.accessTokenProvider();
    let body: unknown = undefined;
    if (input.amount !== undefined) {
      if (!input.providerPaymentId) {
        throw new Error('Mercado Pago Point partial refund requires providerPaymentId.');
      }
      body = {
        transactions: [
          {
            id: input.providerPaymentId,
            amount: clpAmount(input.amount.amountMinor, input.amount.currency),
          },
        ],
      };
    }

    const response = await this.http.request<MercadoPagoPointOrder>({
      method: 'POST',
      url: `${this.baseUrl}/v1/orders/${encodeURIComponent(input.providerReference)}/refund`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      ...(body === undefined ? {} : { body }),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Mercado Pago Point refund failed with HTTP ${response.status}.`);
    }
    return providerStatusResult(response.body);
  }
}
