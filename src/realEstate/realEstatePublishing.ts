import type {
  ListingPublisherType,
  PropertyTransactionType,
  PropertyType,
} from './realEstateContracts.js';
import type { RealEstateMediaRef } from './realEstateMedia.js';
import { REAL_ESTATE_MAX_MEDIA_ITEMS } from './realEstateMediaUpload.js';

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
  /** Backward-compatible count for existing local drafts. */
  photoCount: number;
  /** Canonical Media Core references for new drafts. */
  media?: readonly RealEstateMediaRef[];
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

  const mediaCount = input.media?.length ?? input.photoCount;
  if (!Number.isInteger(mediaCount) || mediaCount < 0 || mediaCount > REAL_ESTATE_MAX_MEDIA_ITEMS) {
    errors.push({ field: 'photoCount', message: `Puedes agregar hasta ${REAL_ESTATE_MAX_MEDIA_ITEMS} fotos.` });
  }
  if (input.media) {
    const ids = new Set<string>();
    let covers = 0;
    for (const item of input.media) {
      if (!item.mediaAssetId.trim() || ids.has(item.mediaAssetId)) {
        errors.push({ field: 'media', message: 'Las fotos deben tener identificadores únicos.' });
        break;
      }
      ids.add(item.mediaAssetId);
      if (item.role === 'cover') covers += 1;
    }
    if (covers > 1) {
      errors.push({ field: 'media', message: 'Solo una foto puede ser la portada.' });
    }
    if (input.photoCount !== input.media.length) {
      errors.push({ field: 'photoCount', message: 'La cantidad de fotos no coincide con los archivos cargados.' });
    }
  }
  return errors;
}

export function createRealEstateDraft(
  input: RealEstateListingDraftInput,
  options?: { id?: string; now?: string; createdAt?: string },
): RealEstateListingDraft {
  const now = options?.now ?? new Date().toISOString();
  const normalizedInput = input.media
    ? { ...input, photoCount: input.media.length }
    : input;
  return {
    ...normalizedInput,
    id: options?.id ?? `draft-${Date.now()}`,
    status: validateRealEstateDraft(normalizedInput).length === 0 ? 'ready_for_review' : 'draft',
    createdAt: options?.createdAt ?? now,
    updatedAt: now,
  };
}
