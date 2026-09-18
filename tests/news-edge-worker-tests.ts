import worker from '../infra/cloudflare/src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeR2Object {
  readonly size: number;
  readonly httpEtag: string;
  readonly body: ReadableStream<Uint8Array>;

  constructor(private readonly bytes: Uint8Array, etag = '"news-etag-1"') {
    this.size = bytes.byteLength;
    this.httpEtag = etag;
    this.body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  writeHttpMetadata(headers: Headers): void {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
}

class FakeR2Bucket {
  constructor(private readonly rows = new Map<string, { bytes: Uint8Array; etag: string }>()) {}

  async head(key: string): Promise<FakeR2Object | null> {
    const row = this.rows.get(key);
    return row ? new FakeR2Object(row.bytes, row.etag) : null;
  }

  async get(key: string): Promise<FakeR2Object | null> {
    const row = this.rows.get(key);
    return row ? new FakeR2Object(row.bytes, row.etag) : null;
  }
}

const encoder = new TextEncoder();
const objectKey = 'public-news/v1/cl/news/home.json';
const homePayload = {
  schemaVersion: 1,
  locale: 'es-CL',
  generatedAt: '2026-09-18T08:00:00-03:00',
  publicationGate: 'open',
  sections: { essential: [], nearby: [], chile: [], local: [], deep_dive: [], voices: [] },
};
const bytes = encoder.encode(JSON.stringify(homePayload));
const bucket = new FakeR2Bucket(new Map([[objectKey, { bytes, etag: '"news-etag-1"' }]]));
const unusedMaps = new FakeR2Bucket();

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function request(path: string, env: Record<string, unknown>, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`https://api.somospalta.cl${path}`, init), env as never);
}

{
  const response = await request('/v1/cl/news/home', { MAPS: unusedMaps });
  assert(response.status === 404, 'News edge must stay hidden when NEWS_PUBLIC_ENABLED is not true.');
  const payload = await json(response);
  assert(payload.reason === 'public_news_disabled', 'Disabled edge must return public_news_disabled.');
}

{
  const response = await request('/v1/cl/news/home', {
    MAPS: unusedMaps,
    NEWS_PUBLIC_ENABLED: 'true',
  });
  assert(response.status === 503, 'Enabled News edge without a confirmed R2 binding must fail closed.');
  const payload = await json(response);
  assert(payload.reason === 'public_news_storage_not_bound', 'Missing binding must be diagnosable.');
}

{
  const response = await request('/v1/cl/news/stories/no-existe', {
    MAPS: unusedMaps,
    NEWS_PUBLIC_ENABLED: 'true',
    NEWS_PUBLIC: bucket,
  });
  assert(response.status === 404, 'Missing public object must return 404.');
  const payload = await json(response);
  assert(payload.reason === 'public_news_not_found', 'Missing object must not be confused with disabled News.');
}

{
  const response = await request('/v1/cl/news/home', {
    MAPS: unusedMaps,
    NEWS_PUBLIC_ENABLED: 'true',
    NEWS_PUBLIC: bucket,
  });
  assert(response.status === 200, 'Confirmed public object must be served when both edge prerequisites are present.');
  assert(response.headers.get('etag') === '"news-etag-1"', 'News object ETag must be preserved.');
  assert((response.headers.get('content-type') ?? '').includes('application/json'), 'News object must be JSON.');
  const payload = await json(response);
  assert(payload.publicationGate === 'open', 'Served fixture must preserve public projection state.');
}

{
  const response = await request('/v1/cl/news/home', {
    MAPS: unusedMaps,
    NEWS_PUBLIC_ENABLED: 'true',
    NEWS_PUBLIC: bucket,
  }, {
    headers: { 'If-None-Match': '"news-etag-1"' },
  });
  assert(response.status === 304, 'Matching News ETag must return 304.');
  assert(response.headers.get('content-length') === null, '304 must not expose a stale Content-Length.');
}

{
  const response = await request('/v1/cl/news/home', {
    MAPS: unusedMaps,
    NEWS_PUBLIC_ENABLED: 'true',
    NEWS_PUBLIC: bucket,
  }, { method: 'HEAD' });
  assert(response.status === 200, 'HEAD must work for a confirmed public News object.');
  assert(response.headers.get('content-length') === String(bytes.byteLength), 'HEAD must expose object length.');
  assert((await response.text()) === '', 'HEAD must not return an object body.');
}

{
  const response = await request('/v1/cl/news/../editorial-reviewed', {
    MAPS: unusedMaps,
    NEWS_PUBLIC_ENABLED: 'true',
    NEWS_PUBLIC: bucket,
  });
  assert(response.status === 404, 'Path traversal/internal News paths must never map to public objects.');
}

console.log('PASS: Palta News edge Worker gate + R2 adapter tests');
