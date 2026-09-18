import type {
  ListingPublisherType,
  PropertyTransactionType,
  PropertyType,
} from './realEstateContracts';

export type RealEstateContactPreference = 'palta' | 'whatsapp' | 'phone';
export type RealEstateDraftStatus = 'draft' | 'ready_for_review';

export type RealEstateListingDraft = {
  id: string;
  status: RealEstateDraftStatus;
  transactionType: PropertyTransactionType;
  propertyType: PropertyType;
  publisherType: ListingPublisherType;
  comuna: string;
  sectorOrAddress: string;
  priceClp?: number;
  priceUf?: number;
  commonExpensesClp?: number;
  usableAreaM2?: number;
  totalAreaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  description?: string;
  contactPreference: RealEstateContactPreference;
  photoCount: number;
  exactAddressPrivate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RealEstateListingDraftInput = Omit<
  RealEstateListingDraft,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

export type RealEstateDraftValidationError = {
  field: keyof RealEstateListingDraftInput | 'price';
  message: string;
};

export interface RealEstateDraftStore {
  listDrafts(): Promise<readonly RealEstateListingDraft[]>;
  getDraft(id: string): Promise<RealEstateListingDraft | null>;
  saveDraft(draft: RealEstateListingDraft): Promise<void>;
  removeDraft(id: string): Promise<void>;
}

export function validateRealEstateDraft(
  input: RealEstateListingDraftInput,
): readonly RealEstateDraftValidationError[] {
  const errors: RealEstateDraftValidationError[] = [];
  if (!input.comuna.trim()) errors.push({ field: 'comuna', message: 'Indica la comuna.' });
  if (!input.sectorOrAddress.trim()) errors.push({ field: 'sectorOrAddress', message: 'Indica el sector o dirección.' });
  if (input.priceClp === undefined && input.priceUf === undefined) {
    errors.push({ field: 'price', message: 'Indica el precio.' });
  }
  if (input.usableAreaM2 !== undefined && input.usableAreaM2 <= 0) {
    errors.push({ field: 'usableAreaM2', message: 'La superficie útil debe ser mayor que cero.' });
  }
  if (input.totalAreaM2 !== undefined && input.totalAreaM2 <= 0) {
    errors.push({ field: 'totalAreaM2', message: 'La superficie total debe ser mayor que cero.' });
  }
  if (
    input.usableAreaM2 !== undefined &&
    input.totalAreaM2 !== undefined &&
    input.totalAreaM2 < input.usableAreaM2
  ) {
    errors.push({ field: 'totalAreaM2', message: 'La superficie total no puede ser menor que la útil.' });
  }
  return errors;
}

export function createRealEstateDraft(
  input: RealEstateListingDraftInput,
  options?: { id?: string; now?: string },
): RealEstateListingDraft {
  const now = options?.now ?? new Date().toISOString();
  return {
    ...input,
    id: options?.id ?? `draft-${Date.now()}`,
    status: validateRealEstateDraft(input).length === 0 ? 'ready_for_review' : 'draft',
    createdAt: now,
    updatedAt: now,
  };
}
