import {
  demoRealEstateContexts,
  demoRealEstateListings,
} from './real-estate-demo-fixtures.mjs';
import { demoRealEstateMedia } from './real-estate-media-fixtures.mjs';

const uploadSessions = new Map();
const uploadedAssets = new Map();
let uploadSequence = 0;

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function optionalNumber(searchParams, key) {
  const raw = searchParams.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function within(value, min, max) {
  if (min !== undefined && (value === undefined || value < min)) return false;
  if (max !== undefined && (value === undefined || value > max)) return false;
  return true;
}

function matchesListing(item, url) {
  if (item.status !== 'active') return false;

  const q = normalize(url.searchParams.get('q'));
  const businessId = url.searchParams.get('businessId');
  const transaction = url.searchParams.get('transaction');
  const propertyType = url.searchParams.get('propertyType');
  const publisher = url.searchParams.get('publisher');

  if (businessId && item.publisher_business_id !== businessId) return false;
  if (transaction && item.transaction_type !== transaction) return false;
  if (propertyType && item.property_type !== propertyType) return false;
  if (publisher && item.publisher_type !== publisher) return false;

  if (!within(item.price_clp, optionalNumber(url.searchParams, 'minPriceClp'), optionalNumber(url.searchParams, 'maxPriceClp'))) return false;
  if (!within(item.price_uf, optionalNumber(url.searchParams, 'minPriceUf'), optionalNumber(url.searchParams, 'maxPriceUf'))) return false;
  if (!within(item.usable_area_m2, optionalNumber(url.searchParams, 'minArea'), optionalNumber(url.searchParams, 'maxArea'))) return false;
  if (!within(item.bedrooms, optionalNumber(url.searchParams, 'minBedrooms'), undefined)) return false;
  if (!within(item.bathrooms, optionalNumber(url.searchParams, 'minBathrooms'), undefined)) return false;
  if (!within(item.parking_spaces, optionalNumber(url.searchParams, 'minParking'), undefined)) return false;

  if (!q) return true;
  const haystack = normalize([
    item.comuna,
    item.sector,
    item.display_address,
    item.publisher_label,
    item.property_type,
  ].filter(Boolean).join(' '));
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

function readBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('request_body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buffer = await readBody(req, 256 * 1024);
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString('utf8'));
}

function absolutePublicUrl(url, pathname) {
  return `${url.protocol}//${url.host}${pathname}`;
}

function createUploadSession(body, url) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  if (!body || typeof body !== 'object') return { error: 'invalid_payload' };
  if (typeof body.draft_id !== 'string' || !body.draft_id.trim()) return { error: 'draft_id_required' };
  if (body.kind !== 'image' && body.kind !== 'floor_plan') return { error: 'invalid_media_kind' };
  if (!['cover', 'gallery', 'floor_plan'].includes(body.role)) return { error: 'invalid_media_role' };
  if (!allowedTypes.has(body.content_type)) return { error: 'invalid_content_type' };
  if (!Number.isFinite(body.byte_size) || body.byte_size <= 0 || body.byte_size > 20 * 1024 * 1024) {
    return { error: 'invalid_byte_size' };
  }

  uploadSequence += 1;
  const uploadId = `re-upload-${uploadSequence}`;
  const mediaAssetId = `re-asset-${uploadSequence}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  uploadSessions.set(uploadId, {
    uploadId,
    mediaAssetId,
    draftId: body.draft_id,
    kind: body.kind,
    role: body.role,
    contentType: body.content_type,
    byteSize: body.byte_size,
    fileName: typeof body.file_name === 'string' ? body.file_name : undefined,
    expiresAt,
    uploaded: false,
  });

  return {
    upload_id: uploadId,
    media_asset_id: mediaAssetId,
    upload_url: absolutePublicUrl(url, `/v1/real-estate/media/uploads/${encodeURIComponent(uploadId)}/content`),
    upload_method: 'PUT',
    required_headers: { 'Content-Type': body.content_type },
    expires_at: expiresAt,
  };
}

export function searchRealEstateListings(url) {
  return demoRealEstateListings
    .filter((item) => matchesListing(item, url))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

export async function handleRealEstateRequest({ req, res, url, json }) {
  if (req.method === 'POST' && url.pathname === '/v1/real-estate/media/uploads') {
    try {
      const body = await readJson(req);
      const session = createUploadSession(body, url);
      if ('error' in session) {
        json(res, 400, session);
        return true;
      }
      json(res, 201, session);
      return true;
    } catch {
      json(res, 400, { error: 'invalid_json' });
      return true;
    }
  }

  const uploadContentMatch = url.pathname.match(/^\/v1\/real-estate\/media\/uploads\/([^/]+)\/content$/);
  if (req.method === 'PUT' && uploadContentMatch) {
    const uploadId = decodeURIComponent(uploadContentMatch[1]);
    const session = uploadSessions.get(uploadId);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      json(res, 404, { error: 'real_estate_media_upload_not_found' });
      return true;
    }
    try {
      const body = await readBody(req, 20 * 1024 * 1024 + 1024);
      if (!body.length || body.length > 20 * 1024 * 1024) {
        json(res, 400, { error: 'invalid_media_body' });
        return true;
      }
      const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim();
      if (contentType !== session.contentType) {
        json(res, 400, { error: 'content_type_mismatch' });
        return true;
      }
      session.uploaded = true;
      uploadedAssets.set(session.mediaAssetId, { body, contentType });
      res.writeHead(204, {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
      return true;
    } catch {
      json(res, 413, { error: 'media_body_too_large' });
      return true;
    }
  }

  const uploadCompleteMatch = url.pathname.match(/^\/v1\/real-estate\/media\/uploads\/([^/]+)\/complete$/);
  if (req.method === 'POST' && uploadCompleteMatch) {
    const uploadId = decodeURIComponent(uploadCompleteMatch[1]);
    const session = uploadSessions.get(uploadId);
    if (!session || !session.uploaded) {
      json(res, 409, { error: 'real_estate_media_upload_incomplete' });
      return true;
    }
    json(res, 200, {
      upload_id: session.uploadId,
      media_asset_id: session.mediaAssetId,
      status: 'ready',
      delivery_url: absolutePublicUrl(url, `/v1/real-estate/media/assets/${encodeURIComponent(session.mediaAssetId)}`),
    });
    return true;
  }

  const assetMatch = url.pathname.match(/^\/v1\/real-estate\/media\/assets\/([^/]+)$/);
  if (req.method === 'GET' && assetMatch) {
    const mediaAssetId = decodeURIComponent(assetMatch[1]);
    const asset = uploadedAssets.get(mediaAssetId);
    if (!asset) {
      json(res, 404, { error: 'real_estate_media_asset_not_found' });
      return true;
    }
    res.writeHead(200, {
      'Content-Type': asset.contentType,
      'Content-Length': asset.body.length,
      'Cache-Control': 'private, max-age=60',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(asset.body);
    return true;
  }

  if (req.method !== 'GET') return false;

  if (url.pathname === '/v1/real-estate/listings') {
    json(res, 200, {
      generated_at: new Date().toISOString(),
      items: searchRealEstateListings(url),
    });
    return true;
  }

  const contextMatch = url.pathname.match(/^\/v1\/real-estate\/properties\/([^/]+)\/context$/);
  if (contextMatch) {
    const propertyId = decodeURIComponent(contextMatch[1]);
    const context = demoRealEstateContexts.find((candidate) => candidate.property_id === propertyId);
    if (!context) {
      json(res, 404, { error: 'real_estate_property_context_not_found' });
      return true;
    }
    json(res, 200, context);
    return true;
  }

  const mediaMatch = url.pathname.match(/^\/v1\/real-estate\/listings\/([^/]+)\/media$/);
  if (mediaMatch) {
    const listingId = decodeURIComponent(mediaMatch[1]);
    const listing = demoRealEstateListings.find((candidate) => candidate.listing_id === listingId);
    const media = demoRealEstateMedia.find((candidate) => candidate.listing_id === listingId);
    if (!listing || listing.status !== 'active' || !media) {
      json(res, 404, { error: 'real_estate_listing_media_not_found' });
      return true;
    }
    json(res, 200, media);
    return true;
  }

  if (url.pathname.startsWith('/v1/real-estate/listings/')) {
    const listingId = decodeURIComponent(url.pathname.slice('/v1/real-estate/listings/'.length));
    const item = demoRealEstateListings.find((candidate) => candidate.listing_id === listingId);
    if (!item || item.status !== 'active') {
      json(res, 404, { error: 'real_estate_listing_not_found' });
      return true;
    }
    json(res, 200, item);
    return true;
  }

  return false;
}
