import type { RealEstateListingDraft } from './realEstatePublishing.js';
import { validateRealEstateDraft } from './realEstatePublishing.js';

export type RealEstatePublicationSubmissionStatus =
  | 'pending_review'
  | 'requires_verification'
  | 'published';

export type RealEstatePublicationSubmissionResult = {
  submissionId: string;
  draftId: string;
  status: RealEstatePublicationSubmissionStatus;
  listingId?: string;
  message?: string;
};

export type RealEstatePublicationReadinessError = {
  code:
    | 'draft_incomplete'
    | 'real_media_required'
    | 'verified_business_required';
  message: string;
};

export interface RealEstatePublicationGateway {
  submitDraft(draft: RealEstateListingDraft): Promise<RealEstatePublicationSubmissionResult>;
}

export function validateRealEstatePublicationReadiness(
  draft: RealEstateListingDraft,
): readonly RealEstatePublicationReadinessError[] {
  const errors: RealEstatePublicationReadinessError[] = [];
  const draftInput = {
    transactionType: draft.transactionType,
    propertyType: draft.propertyType,
    publisherType: draft.publisherType,
    ...(draft.publisherBusinessId ? { publisherBusinessId: draft.publisherBusinessId } : {}),
    comuna: draft.comuna,
    sectorOrAddress: draft.sectorOrAddress,
    ...(draft.priceClp !== undefined ? { priceClp: draft.priceClp } : {}),
    ...(draft.priceUf !== undefined ? { priceUf: draft.priceUf } : {}),
    ...(draft.commonExpensesClp !== undefined ? { commonExpensesClp: draft.commonExpensesClp } : {}),
    ...(draft.usableAreaM2 !== undefined ? { usableAreaM2: draft.usableAreaM2 } : {}),
    ...(draft.totalAreaM2 !== undefined ? { totalAreaM2: draft.totalAreaM2 } : {}),
    ...(draft.bedrooms !== undefined ? { bedrooms: draft.bedrooms } : {}),
    ...(draft.bathrooms !== undefined ? { bathrooms: draft.bathrooms } : {}),
    ...(draft.parkingSpaces !== undefined ? { parkingSpaces: draft.parkingSpaces } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    contactPreference: draft.contactPreference,
    photoCount: draft.photoCount,
    ...(draft.media ? { media: draft.media } : {}),
    exactAddressPrivate: draft.exactAddressPrivate,
  };

  if (validateRealEstateDraft(draftInput).length > 0) {
    errors.push({
      code: 'draft_incomplete',
      message: 'Completa los datos obligatorios antes de enviar la publicación.',
    });
  }

  const realImages = draft.media?.filter(
    (item) => item.kind === 'image' && item.mediaAssetId.trim().length > 0,
  ) ?? [];
  if (realImages.length === 0) {
    errors.push({
      code: 'real_media_required',
      message: 'Agrega al menos una foto real antes de enviar la publicación.',
    });
  }

  if (draft.publisherType !== 'owner_direct' && !draft.publisherBusinessId) {
    errors.push({
      code: 'verified_business_required',
      message: 'Vincula un Business Profile verificado antes de publicar como Corredor o Inmobiliaria.',
    });
  }

  return errors;
}
