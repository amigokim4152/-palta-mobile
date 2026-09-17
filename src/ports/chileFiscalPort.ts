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

export interface ChileFiscalPort {
  readonly country: 'CL';
  validate(request: FiscalRequest): Promise<FiscalValidationResult>;
  buildAndSign(request: FiscalRequest): Promise<{
    signedXml: string;
    signedAt: string;
  }>;
  send(request: FiscalRequest, signedXml: string): Promise<SiiSendResult>;
  reconcile(request: FiscalRequest): Promise<SiiSendResult>;
}
