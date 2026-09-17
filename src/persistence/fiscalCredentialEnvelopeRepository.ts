import type {
  FiscalCredentialEnvelope,
  FiscalCredentialIdentity,
} from '../fiscal/chile/fiscalCredentialEnvelope.js';

export type FiscalCredentialEnvelopeLookup = FiscalCredentialIdentity;

export type FiscalCredentialEnvelopeWrite = {
  envelope: FiscalCredentialEnvelope;
  expectedRevision: number | null;
};

export class FiscalCredentialConcurrencyError extends Error {
  constructor(message = 'Fiscal credential revision conflict.') {
    super(message);
    this.name = 'FiscalCredentialConcurrencyError';
  }
}

export interface FiscalCredentialEnvelopeRepository {
  findEnvelope(lookup: FiscalCredentialEnvelopeLookup): Promise<FiscalCredentialEnvelope | null>;
  saveEnvelope(write: FiscalCredentialEnvelopeWrite): Promise<FiscalCredentialEnvelope>;
}
