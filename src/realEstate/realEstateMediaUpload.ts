import type { RealEstateMediaKind, RealEstateMediaRef, RealEstateMediaRole } from './realEstateMedia.js';

export const REAL_ESTATE_MAX_MEDIA_ITEMS = 6;
export const REAL_ESTATE_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type RealEstateUploadContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export type RealEstateMediaUploadRequest = {
  draftId: string;
  kind: RealEstateMediaKind;
  role: RealEstateMediaRole;
  contentType: RealEstateUploadContentType;
  byteSize: number;
  fileName?: string;
};

export type RealEstateMediaUploadSession = {
  uploadId: string;
  mediaAssetId: string;
  uploadUrl: string;
  uploadMethod: 'PUT';
  requiredHeaders: Readonly<Record<string, string>>;
  expiresAt: string;
};

export type RealEstateMediaUploadCompletion = {
  uploadId: string;
  mediaAssetId: string;
  status: 'processing' | 'ready';
  deliveryUrl?: string;
  width?: number;
  height?: number;
};

export interface RealEstateMediaUploadGateway {
  createUploadSession(input: RealEstateMediaUploadRequest): Promise<RealEstateMediaUploadSession>;
  completeUpload(uploadId: string): Promise<RealEstateMediaUploadCompletion>;
}

export function validateRealEstateMediaUploadRequest(
  input: RealEstateMediaUploadRequest,
): readonly string[] {
  const errors: string[] = [];
  if (!input.draftId.trim()) errors.push('draftId is required.');
  if (input.kind !== 'image' && input.kind !== 'floor_plan') errors.push('Unsupported media kind.');
  if (input.role === 'floor_plan' && input.kind !== 'floor_plan') {
    errors.push('floor_plan role requires floor_plan kind.');
  }
  if (input.role !== 'floor_plan' && input.kind !== 'image') {
    errors.push('cover/gallery roles require image kind.');
  }
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) errors.push('byteSize must be positive.');
  if (input.byteSize > REAL_ESTATE_MAX_IMAGE_BYTES) {
    errors.push(`Media exceeds ${REAL_ESTATE_MAX_IMAGE_BYTES} bytes.`);
  }
  return errors;
}

export function mediaRefFromUploadCompletion(input: {
  completion: RealEstateMediaUploadCompletion;
  role: RealEstateMediaRole;
  kind: RealEstateMediaKind;
  sortOrder: number;
  altText?: string;
}): RealEstateMediaRef {
  const { completion } = input;
  return {
    mediaAssetId: completion.mediaAssetId,
    kind: input.kind,
    role: input.role,
    sortOrder: input.sortOrder,
    ...(completion.deliveryUrl ? { deliveryUrl: completion.deliveryUrl } : {}),
    ...(completion.width !== undefined ? { width: completion.width } : {}),
    ...(completion.height !== undefined ? { height: completion.height } : {}),
    ...(input.altText ? { altText: input.altText } : {}),
  };
}
