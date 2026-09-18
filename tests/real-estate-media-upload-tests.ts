import { RealEstateMediaUploadApiClient } from '../src/api/realEstateMediaUploadApiClient.js';
import {
  REAL_ESTATE_MAX_IMAGE_BYTES,
  mediaRefFromUploadCompletion,
  validateRealEstateMediaUploadRequest,
} from '../src/realEstate/realEstateMediaUpload.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const invalid = validateRealEstateMediaUploadRequest({
  draftId: '',
  kind: 'image',
  role: 'cover',
  contentType: 'image/jpeg',
  byteSize: REAL_ESTATE_MAX_IMAGE_BYTES + 1,
});
assert(invalid.length === 2, 'Upload validation should reject missing draft id and oversized media.');

const requests: Array<{ url: string; method?: string; body?: string; headers?: Record<string, string> }> = [];
const client = new RealEstateMediaUploadApiClient({
  baseUrl: 'https://api.somospalta.cl/',
  getAccessToken: async () => 'media-token',
  fetch: async (url, init) => {
    requests.push({ url, ...init });
    if (url.endsWith('/v1/real-estate/media/uploads')) {
      return {
        ok: true,
        status: 201,
        async json() {
          return {
            upload_id: 'upload-1',
            media_asset_id: 'asset-1',
            upload_url: 'https://media.example/upload-1',
            upload_method: 'PUT',
            required_headers: { 'Content-Type': 'image/jpeg' },
            expires_at: '2026-09-18T13:00:00Z',
          };
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          upload_id: 'upload-1',
          media_asset_id: 'asset-1',
          status: 'ready',
          delivery_url: 'https://media.example/assets/asset-1',
          width: 1600,
          height: 1200,
        };
      },
    };
  },
});

const session = await client.createUploadSession({
  draftId: 'draft-1',
  kind: 'image',
  role: 'cover',
  contentType: 'image/jpeg',
  byteSize: 1024,
  fileName: 'living-room.jpg',
});
assert(session.mediaAssetId === 'asset-1', 'Upload session must preserve Media Core asset id.');
assert(requests[0]?.method === 'POST', 'Upload session must use POST.');
assert(requests[0]?.headers?.Authorization === 'Bearer media-token', 'Upload session must use Palta auth.');
const createPayload = JSON.parse(requests[0]?.body ?? '{}');
assert(createPayload.draft_id === 'draft-1', 'Upload session must bind to stable client draft id.');
assert(createPayload.role === 'cover', 'Upload role must be explicit.');

const completion = await client.completeUpload(session.uploadId);
assert(completion.status === 'ready', 'Completed upload should surface ready status.');
const ref = mediaRefFromUploadCompletion({
  completion,
  role: 'cover',
  kind: 'image',
  sortOrder: 0,
  altText: 'Sala principal',
});
assert(ref.mediaAssetId === 'asset-1', 'Listing media ref must use canonical asset id.');
assert(ref.deliveryUrl === 'https://media.example/assets/asset-1', 'Delivery URL should be a projection, not storage ownership.');
assert(ref.width === 1600 && ref.height === 1200, 'Media dimensions should survive projection.');

console.log('PASS: real-estate direct media upload session contracts');
