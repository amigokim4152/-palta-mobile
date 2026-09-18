import type { BusinessId, ListingId } from './realEstateContracts.js';

export type RealEstateInquiryChannel = 'palta' | 'whatsapp' | 'phone';
export type RealEstateInquiryStatus = 'draft' | 'ready_to_send' | 'sent';

export type RealEstateInquiryDraft = {
  id: string;
  listingId: ListingId;
  publisherBusinessId?: BusinessId;
  channel: RealEstateInquiryChannel;
  message: string;
  visitRequested: boolean;
  financingQuestion: boolean;
  status: RealEstateInquiryStatus;
  createdAt: string;
  updatedAt: string;
};

export type RealEstateInquiryInput = {
  listingId: ListingId;
  publisherBusinessId?: BusinessId;
  channel: RealEstateInquiryChannel;
  message: string;
  visitRequested: boolean;
  financingQuestion: boolean;
};

export interface RealEstateInquiryDraftStore {
  listDrafts(): Promise<readonly RealEstateInquiryDraft[]>;
  saveDraft(draft: RealEstateInquiryDraft): Promise<void>;
  removeDraft(id: string): Promise<void>;
}

export function createRealEstateInquiryDraft(
  input: RealEstateInquiryInput,
  options?: { id?: string; now?: string },
): RealEstateInquiryDraft {
  const now = options?.now ?? new Date().toISOString();
  const message = input.message.trim();
  return {
    id: options?.id ?? `property-inquiry-${Date.now()}`,
    listingId: input.listingId,
    ...(input.publisherBusinessId ? { publisherBusinessId: input.publisherBusinessId } : {}),
    channel: input.channel,
    message,
    visitRequested: input.visitRequested,
    financingQuestion: input.financingQuestion,
    status: message.length >= 5 ? 'ready_to_send' : 'draft',
    createdAt: now,
    updatedAt: now,
  };
}
