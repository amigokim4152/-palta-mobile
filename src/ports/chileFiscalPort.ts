import type {
  FiscalRequest,
  FiscalValidationResult,
  FolioReservation,
  FolioReservationRequest,
  SiiSendResult,
} from '../fiscal/chile/fiscalModel.js';

export interface FolioAllocatorPort {
  reserve(request: FolioReservationRequest): Promise<FolioReservation>;
}

/**
 * SII Direct execution boundary only.
 *
 * This port intentionally models Palta owning CAF allocation, XML construction,
 * signing and transport to SII. External DTE providers must use
 * ChileExternalFiscalPort instead and must not be forced through fake
 * buildAndSign/send stages.
 */
export interface ChileSiiDirectPort {
  readonly country: 'CL';
  validate(request: FiscalRequest): Promise<FiscalValidationResult>;
  buildAndSign(request: FiscalRequest): Promise<{
    signedXml: string;
    signedAt: string;
  }>;
  send(request: FiscalRequest, signedXml: string): Promise<SiiSendResult>;
  reconcile(request: FiscalRequest): Promise<SiiSendResult>;
}

/** @deprecated Use ChileSiiDirectPort for direct SII implementations. */
export type ChileFiscalPort = ChileSiiDirectPort;
