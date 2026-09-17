import { PaymentProviderOperationError, type PaymentIncidentKind } from '../../payment/paymentIncident.js';
import type { PaymentStatus } from '../../payment/paymentModel.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
  ReconcilePaymentInput,
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

export type MercadoPagoApiError = {
  code?: string;
  error?: string;
  message?: string;
  status?: number;
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

function providerErrorCode(body: MercadoPagoApiError): string | undefined {
  return body.code ?? body.error;
}

export function classifyMercadoPagoHttpFailure(
  status: number,
  body: MercadoPagoApiError,
): PaymentIncidentKind {
  const code = providerErrorCode(body);
  if (status === 400) return 'validation_error';
  if (status === 401 || status === 403) return 'configuration_error';
  if (status === 409 && code === 'already_queued_order_for_terminal') return 'terminal_busy';
  if (status === 409 && code === 'idempotency_key_already_used') return 'idempotency_conflict';
  if (status === 409) return 'provider_error';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'transient_provider_error';
  return 'provider_error';
}

function throwHttpFailure(
  operation: string,
  response: JsonHttpResponse<MercadoPagoApiError>,
): never {
  const code = providerErrorCode(response.body);
  throw new PaymentProviderOperationError({
    providerKey: 'mercadopago_point',
    incidentKind: classifyMercadoPagoHttpFailure(response.status, response.body),
    message: `Mercado Pago Point ${operation} failed with HTTP ${response.status}${code ? ` (${code})` : ''}.`,
    ...(code === undefined ? {} : { providerCode: code }),
    httpStatus: response.status,
  });
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
    let response: JsonHttpResponse<MercadoPagoPointOrder | MercadoPagoApiError>;
    try {
      response = await this.http.request<MercadoPagoPointOrder | MercadoPagoApiError>({
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
    } catch (error) {
      if (error instanceof PaymentProviderOperationError) throw error;
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'outcome_unknown',
        message: 'Mercado Pago Point create order transport outcome is unknown; reconcile before another charge.',
      });
    }

    if (response.status < 200 || response.status >= 300) {
      throwHttpFailure('create order', response as JsonHttpResponse<MercadoPagoApiError>);
    }
    return { ...providerStatusResult(response.body as MercadoPagoPointOrder) };
  }

  async getStatus(providerReference: string): Promise<ProviderPaymentStatus> {
    const token = await this.accessTokenProvider();
    let response: JsonHttpResponse<MercadoPagoPointOrder | MercadoPagoApiError>;
    try {
      response = await this.http.request<MercadoPagoPointOrder | MercadoPagoApiError>({
        method: 'GET',
        url: `${this.baseUrl}/v1/orders/${encodeURIComponent(providerReference)}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof PaymentProviderOperationError) throw error;
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'transient_provider_error',
        message: 'Mercado Pago Point status lookup failed; retry the same status lookup with backoff.',
      });
    }
    if (response.status < 200 || response.status >= 300) {
      throwHttpFailure('get order', response as JsonHttpResponse<MercadoPagoApiError>);
    }
    return providerStatusResult(response.body as MercadoPagoPointOrder);
  }

  async reconcilePayment(input: ReconcilePaymentInput): Promise<ProviderPaymentStatus> {
    if (input.providerReference) return this.getStatus(input.providerReference);

    // Mercado Pago Orders requires X-Idempotency-Key and documents safe replay of the
    // same operation. Replaying the exact original request lets Palta recover the
    // provider order reference after a response-loss scenario without creating a
    // replacement charge.
    return this.createPayment(input);
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

    let response: JsonHttpResponse<MercadoPagoPointOrder | MercadoPagoApiError>;
    try {
      response = await this.http.request<MercadoPagoPointOrder | MercadoPagoApiError>({
        method: 'POST',
        url: `${this.baseUrl}/v1/orders/${encodeURIComponent(input.providerReference)}/refund`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': input.idempotencyKey,
        },
        ...(body === undefined ? {} : { body }),
      });
    } catch (error) {
      if (error instanceof PaymentProviderOperationError) throw error;
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'refund_unknown',
        message: 'Mercado Pago Point refund transport outcome is unknown; reconcile refund status before retrying.',
      });
    }
    if (response.status < 200 || response.status >= 300) {
      throwHttpFailure('refund', response as JsonHttpResponse<MercadoPagoApiError>);
    }
    return providerStatusResult(response.body as MercadoPagoPointOrder);
  }
}
