import type { FetchLike } from './paltaApiClient.js';
import type {
  RealEstateMediaUploadCompletion,
  RealEstateMediaUploadGateway,
  RealEstateMediaUploadRequest,
  RealEstateMediaUploadSession,
} from '../realEstate/realEstateMediaUpload.js';
import { validateRealEstateMediaUploadRequest } from '../realEstate/realEstateMediaUpload.js';

export type RealEstateMediaUploadApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string');
}

function validateSession(value: unknown): RealEstateMediaUploadSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Media upload session returned a non-object payload.');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.upload_id !== 'string' ||
    typeof row.media_asset_id !== 'string' ||
    typeof row.upload_url !== 'string' ||
    row.upload_method !== 'PUT' ||
    !isStringRecord(row.required_headers) ||
    typeof row.expires_at !== 'string'
  ) {
    throw new Error('Media upload session returned an invalid payload.');
  }
  return {
    uploadId: row.upload_id,
    mediaAssetId: row.media_asset_id,
    uploadUrl: row.upload_url,
    uploadMethod: 'PUT',
    requiredHeaders: row.required_headers,
    expiresAt: row.expires_at,
  };
}

function validateCompletion(value: unknown): RealEstateMediaUploadCompletion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Media upload completion returned a non-object payload.');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.upload_id !== 'string' ||
    typeof row.media_asset_id !== 'string' ||
    (row.status !== 'processing' && row.status !== 'ready') ||
    (row.delivery_url !== undefined && typeof row.delivery_url !== 'string') ||
    (row.width !== undefined && (typeof row.width !== 'number' || !Number.isFinite(row.width))) ||
    (row.height !== undefined && (typeof row.height !== 'number' || !Number.isFinite(row.height)))
  ) {
    throw new Error('Media upload completion returned an invalid payload.');
  }
  return {
    uploadId: row.upload_id,
    mediaAssetId: row.media_asset_id,
    status: row.status,
    ...(typeof row.delivery_url === 'string' ? { deliveryUrl: row.delivery_url } : {}),
    ...(typeof row.width === 'number' ? { width: row.width } : {}),
    ...(typeof row.height === 'number' ? { height: row.height } : {}),
  };
}

export class RealEstateMediaUploadApiClient implements RealEstateMediaUploadGateway {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: RealEstateMediaUploadApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async post(path: string, body?: unknown): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) throw new Error(`Palta media upload API failed: ${response.status}`);
    return response.json();
  }

  async createUploadSession(input: RealEstateMediaUploadRequest): Promise<RealEstateMediaUploadSession> {
    const errors = validateRealEstateMediaUploadRequest(input);
    if (errors.length) throw new Error(errors.join(' '));
    return validateSession(await this.post('/v1/real-estate/media/uploads', {
      draft_id: input.draftId,
      kind: input.kind,
      role: input.role,
      content_type: input.contentType,
      byte_size: input.byteSize,
      ...(input.fileName ? { file_name: input.fileName } : {}),
    }));
  }

  async completeUpload(uploadId: string): Promise<RealEstateMediaUploadCompletion> {
    if (!uploadId.trim()) throw new Error('uploadId is required.');
    return validateCompletion(await this.post(
      `/v1/real-estate/media/uploads/${encodeURIComponent(uploadId)}/complete`,
    ));
  }
}
