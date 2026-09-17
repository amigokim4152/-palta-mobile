import { CHILE_DTE_CODE, assertFiscalTotals } from '../../fiscal/chile/fiscalModel.js';
import {
  FiscalProviderOperationError,
  type FiscalProviderIncidentKind,
} from '../../fiscal/chile/fiscalProviderIncident.js';
import type {
  ChileExternalFiscalPort,
  ExternalFiscalIssueInput,
  ExternalFiscalProviderResult,
  ExternalFiscalReconcileInput,
} from '../../ports/chileExternalFiscalPort.js';

export type DteComgesHttpResponse<T> = {
  status: number;
  body: T;
};

export interface DteComgesHttpClient {
  request<T>(input: {
    method: 'GET' | 'POST';
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  }): Promise<DteComgesHttpResponse<T>>;
}

export type DteComgesApiKeyProvider = () => Promise<string>;

export type DteComgesDocument = {
  id: string;
  tipoDte: number;
  folio: number;
  ambiente?: string;
  montoNeto?: number;
  montoExento?: number;
  montoIva?: number;
  montoTotal?: number;
  estadoSii?: string;
  trackId?: string | null;
  glosaSii?: string | null;
  ted?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  fechaEmision?: string;
};

export type DteComgesPendingTicket = {
  ticketId: string;
  estado: string;
  posicionEnCola?: number;
  documentoId?: string | null;
  esErrorTerminal?: boolean;
  codigoError?: string | null;
  mensaje?: string | null;
};

export type DteComgesApiError = {
  code?: string;
  codigo?: string;
  message?: string;
  mensaje?: string;
  error?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertInitialDocumentScope(input: ExternalFiscalIssueInput): void {
  if (input.documentType !== 'boleta_39' && input.documentType !== 'factura_33') {
    throw new Error(`DTE Comges initial Palta adapter does not release ${input.documentType} yet.`);
  }
  if (!UUID_RE.test(input.canonicalFiscalRequestId)) {
    throw new Error('DTE Comges transactionId requires canonicalFiscalRequestId to be a UUID.');
  }
  if (!input.receiver.rut?.trim() || !input.receiver.name?.trim()) {
    throw new Error('DTE Comges initial adapter requires receiver RUT and name.');
  }
  if (input.documentType === 'factura_33') {
    if (!input.receiver.giro?.trim() || !input.receiver.address?.trim() || !input.receiver.commune?.trim()) {
      throw new Error('Factura 33 requires receiver giro, address and commune.');
    }
    if (input.receiver.giro.length > 40) {
      throw new Error('DTE Comges/SII receiver giro must not exceed 40 characters.');
    }
    if (input.receiver.commune.length > 20) {
      throw new Error('DTE Comges/SII receiver commune must not exceed 20 characters.');
    }
  }
  if (input.lines.length === 0) throw new Error('DTE Comges issue requires at least one line.');
  for (const line of input.lines) {
    if (line.exempt) {
      throw new Error('Initial DTE Comges adapter supports affected Boleta 39 / Factura 33 only.');
    }
    if (!line.description.trim()) throw new Error('Fiscal line description is required.');
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error('Fiscal line quantity must be positive.');
    }
    if (!Number.isSafeInteger(line.unitNetAmountMinor) || line.unitNetAmountMinor < 0) {
      throw new Error('Fiscal line unitNetAmountMinor must be a non-negative safe integer.');
    }
    if (!line.unitCode.trim() || line.unitCode.length > 4) {
      throw new Error('DTE Comges/SII unitCode must contain 1 to 4 characters.');
    }
  }
  assertFiscalTotals(input.totals);
}

function apiErrorCode(body: DteComgesApiError): string | undefined {
  return body.code ?? body.codigo ?? body.error;
}

export function classifyDteComgesHttpFailure(status: number): FiscalProviderIncidentKind {
  if (status === 400) return 'validation_error';
  if (status === 401) return 'authentication_error';
  if (status === 403 || status === 409 || status === 422) return 'configuration_error';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'provider_error';
}

function throwHttpFailure(
  operation: string,
  response: DteComgesHttpResponse<DteComgesApiError>,
): never {
  const providerCode = apiErrorCode(response.body);
  throw new FiscalProviderOperationError({
    providerKey: 'dte_comges',
    incidentKind: classifyDteComgesHttpFailure(response.status),
    message: `DTE Comges ${operation} failed with HTTP ${response.status}${providerCode ? ` (${providerCode})` : ''}.`,
    ...(providerCode === undefined ? {} : { providerCode }),
    httpStatus: response.status,
  });
}

function mapAuthorityStatus(status?: string): ExternalFiscalProviderResult['status'] {
  if (!status) return 'issued';
  switch (status.toLowerCase()) {
    case 'aceptado':
      return 'accepted';
    case 'aceptadoconreparos':
    case 'aceptado_con_reparos':
    case 'observado':
      return 'observed';
    case 'rechazado':
      return 'rejected';
    case 'pendiente':
    case 'enviado':
    case 'procesando':
    case 'errorenvio':
    case 'error_envio':
      return 'pending_authority';
    default:
      return 'unknown';
  }
}

function providerTotals(document: DteComgesDocument) {
  if (
    document.montoNeto === undefined ||
    document.montoIva === undefined ||
    document.montoTotal === undefined
  ) {
    return undefined;
  }
  return {
    netAmountMinor: document.montoNeto,
    exemptAmountMinor: document.montoExento ?? 0,
    vatAmountMinor: document.montoIva,
    totalAmountMinor: document.montoTotal,
  };
}

function documentResult(
  document: DteComgesDocument,
  canonicalTotals?: ExternalFiscalIssueInput['totals'],
): ExternalFiscalProviderResult {
  if (!document.id?.trim() || !Number.isSafeInteger(document.folio) || document.folio <= 0) {
    throw new Error('DTE Comges document response is missing canonical document identity/folio.');
  }
  const totals = providerTotals(document);
  const result: ExternalFiscalProviderResult = {
    providerKey: 'dte_comges',
    status: mapAuthorityStatus(document.estadoSii),
    providerStatus: document.estadoSii ?? 'issued',
    providerReference: document.id,
    folio: document.folio,
  };
  if (document.trackId?.trim()) result.authorityTrackId = document.trackId;
  if (document.estadoSii?.trim()) result.authorityStatus = document.estadoSii;
  if (document.glosaSii?.trim()) result.authorityMessage = document.glosaSii;
  if (document.xmlUrl?.trim()) result.xmlUrl = document.xmlUrl;
  if (document.pdfUrl?.trim()) result.pdfUrl = document.pdfUrl;
  if (document.ted?.trim()) result.tedXml = document.ted;
  if (document.fechaEmision?.trim()) result.issuedAt = document.fechaEmision;
  if (totals !== undefined) {
    result.providerTotals = totals;
    if (canonicalTotals !== undefined) {
      result.canonicalTotalsMatch =
        totals.netAmountMinor === canonicalTotals.netAmountMinor &&
        totals.exemptAmountMinor === canonicalTotals.exemptAmountMinor &&
        totals.vatAmountMinor === canonicalTotals.vatAmountMinor &&
        totals.totalAmountMinor === canonicalTotals.totalAmountMinor;
    }
  }
  return result;
}

function pendingResult(ticket: DteComgesPendingTicket): ExternalFiscalProviderResult {
  if (!ticket.ticketId?.trim()) throw new Error('DTE Comges queued response requires ticketId.');
  const normalized = ticket.estado.toLowerCase();
  if (normalized === 'error') {
    return {
      providerKey: 'dte_comges',
      status: ticket.esErrorTerminal ? 'failed' : 'unknown',
      providerStatus: ticket.estado,
      queueTicketReference: ticket.ticketId,
      ...(ticket.mensaje?.trim() ? { authorityMessage: ticket.mensaje } : {}),
    };
  }
  if (normalized === 'cancelado') {
    return {
      providerKey: 'dte_comges',
      status: 'failed',
      providerStatus: ticket.estado,
      queueTicketReference: ticket.ticketId,
      ...(ticket.mensaje?.trim() ? { authorityMessage: ticket.mensaje } : {}),
    };
  }
  return {
    providerKey: 'dte_comges',
    status: 'queued',
    providerStatus: ticket.estado,
    queueTicketReference: ticket.ticketId,
  };
}

function requestBody(input: ExternalFiscalIssueInput) {
  return {
    transactionId: input.canonicalFiscalRequestId,
    tipoDte: CHILE_DTE_CODE[input.documentType],
    receptor: {
      rut: input.receiver.rut,
      razonSocial: input.receiver.name,
      ...(input.documentType === 'factura_33'
        ? {
            giro: input.receiver.giro,
            direccion: input.receiver.address,
            comuna: input.receiver.commune,
          }
        : {}),
    },
    detalles: input.lines.map((line, index) => ({
      nroLinea: index + 1,
      nombreItem: line.description,
      cantidad: line.quantity,
      unidadMedida: line.unitCode,
      precioUnitario: line.unitNetAmountMinor,
    })),
  };
}

export class DteComgesAdapter implements ChileExternalFiscalPort {
  readonly country = 'CL' as const;
  readonly providerKey = 'dte_comges';

  constructor(
    private readonly http: DteComgesHttpClient,
    private readonly apiKeyProvider: DteComgesApiKeyProvider,
    private readonly baseUrl = 'https://api-publica.dtecomges.cl/api/public/v1',
  ) {}

  supportsDocumentType(type: ExternalFiscalIssueInput['documentType']): boolean {
    return type === 'boleta_39' || type === 'factura_33';
  }

  async issue(input: ExternalFiscalIssueInput): Promise<ExternalFiscalProviderResult> {
    assertInitialDocumentScope(input);
    const apiKey = await this.apiKey();
    let response: DteComgesHttpResponse<
      DteComgesDocument | DteComgesPendingTicket | DteComgesApiError
    >;
    try {
      response = await this.http.request({
        method: 'POST',
        url: `${this.baseUrl}/dte`,
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: requestBody(input),
      });
    } catch (error) {
      if (error instanceof FiscalProviderOperationError) throw error;
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'outcome_unknown',
        message: 'DTE Comges issue transport outcome is unknown; reconcile/replay the same transactionId before any replacement issue.',
      });
    }

    if (response.status === 201) {
      return documentResult(response.body as DteComgesDocument, input.totals);
    }
    if (response.status === 202) {
      return pendingResult(response.body as DteComgesPendingTicket);
    }
    throwHttpFailure('issue DTE', response as DteComgesHttpResponse<DteComgesApiError>);
  }

  async reconcile(input: ExternalFiscalReconcileInput): Promise<ExternalFiscalProviderResult> {
    if (input.queueTicketReference?.trim()) {
      const ticket = await this.getPendingTicket(input.queueTicketReference);
      if (
        ticket.estado.toLowerCase() === 'completado' &&
        ticket.documentoId?.trim()
      ) {
        return this.getDocument(ticket.documentoId);
      }
      return pendingResult(ticket);
    }
    if (input.providerReference?.trim()) {
      return this.getDocument(input.providerReference);
    }
    if (input.originalIssue !== undefined) {
      // Provider contract guarantees transactionId idempotency. This is the only
      // safe response-loss recovery when no provider/ticket reference arrived.
      return this.issue(input.originalIssue);
    }
    throw new Error('DTE Comges reconciliation requires provider reference, queue ticket or original issue request.');
  }

  private async getDocument(providerReference: string): Promise<ExternalFiscalProviderResult> {
    const apiKey = await this.apiKey();
    let response: DteComgesHttpResponse<DteComgesDocument | DteComgesApiError>;
    try {
      response = await this.http.request({
        method: 'GET',
        url: `${this.baseUrl}/dte/${encodeURIComponent(providerReference)}`,
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof FiscalProviderOperationError) throw error;
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'transient_provider_error',
        message: 'DTE Comges document status lookup failed; retry the same lookup with backoff.',
      });
    }
    if (response.status < 200 || response.status >= 300) {
      throwHttpFailure('get DTE', response as DteComgesHttpResponse<DteComgesApiError>);
    }
    return documentResult(response.body as DteComgesDocument);
  }

  private async getPendingTicket(ticketId: string): Promise<DteComgesPendingTicket> {
    const apiKey = await this.apiKey();
    let response: DteComgesHttpResponse<DteComgesPendingTicket | DteComgesApiError>;
    try {
      response = await this.http.request({
        method: 'GET',
        url: `${this.baseUrl}/dte/pendientes/${encodeURIComponent(ticketId)}`,
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof FiscalProviderOperationError) throw error;
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'transient_provider_error',
        message: 'DTE Comges pending-ticket lookup failed; retry with backoff.',
      });
    }
    if (response.status < 200 || response.status >= 300) {
      throwHttpFailure('get pending DTE ticket', response as DteComgesHttpResponse<DteComgesApiError>);
    }
    return response.body as DteComgesPendingTicket;
  }

  private async apiKey(): Promise<string> {
    let apiKey: string;
    try {
      apiKey = await this.apiKeyProvider();
    } catch {
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'transient_provider_error',
        message: 'DTE Comges credential store is temporarily unavailable.',
      });
    }
    if (!apiKey.trim()) {
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'configuration_error',
        message: 'DTE Comges API key is not configured for this issuer connection.',
      });
    }
    return apiKey;
  }
}
