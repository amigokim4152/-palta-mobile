type R2UploadedPart = { partNumber: number; etag: string };
type R2MultipartUpload = {
  uploadId: string;
  key: string;
  uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob): Promise<R2UploadedPart>;
  complete(parts: R2UploadedPart[]): Promise<unknown>;
  abort(): Promise<void>;
};
type R2BucketLike = {
  createMultipartUpload(
    key: string,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    },
  ): Promise<R2MultipartUpload>;
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
};
type Env = {
  MAPS: R2BucketLike;
  UPLOAD_TOKEN: string;
};

const LOCAL_JSON_PREFIXES = [
  'palta/cl/local-business/',
  'palta/cl/local-place/',
] as const;
const MAX_JSON_BYTES = 20 * 1024 * 1024;

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function unauthorized(): Response {
  return json({ ok: false, error: 'unauthorized' }, 401);
}

function authOk(request: Request, env: Env): boolean {
  const expected = `Bearer ${env.UPLOAD_TOKEN}`;
  return request.headers.get('authorization') === expected;
}

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function allowedLocalJsonKey(key: string): boolean {
  return (
    LOCAL_JSON_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
    key.endsWith('.json') &&
    !key.includes('..') &&
    !key.includes('\\')
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'palta-data-uploader' });
    }

    if (!authOk(request, env)) return unauthorized();

    try {
      if (url.pathname === '/json' && request.method === 'PUT') {
        const key = requiredHeader(request, 'x-palta-key');
        if (!allowedLocalJsonKey(key)) {
          return json({ ok: false, error: 'local_json_key_not_allowed' }, 400);
        }

        const contentLength = Number(request.headers.get('content-length') ?? '0');
        if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
          return json({ ok: false, error: 'json_snapshot_too_large' }, 413);
        }

        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.byteLength === 0) {
          return json({ ok: false, error: 'body required' }, 400);
        }
        if (bytes.byteLength > MAX_JSON_BYTES) {
          return json({ ok: false, error: 'json_snapshot_too_large' }, 413);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          return json({ ok: false, error: 'invalid_json' }, 400);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return json({ ok: false, error: 'json_snapshot_must_be_object' }, 400);
        }

        const sha256 = request.headers.get('x-palta-sha256') ?? undefined;
        const schemaVersion = request.headers.get('x-palta-schema-version') ?? undefined;
        await env.MAPS.put(key, bytes, {
          httpMetadata: {
            contentType: 'application/json; charset=utf-8',
            cacheControl: key.includes('/current/')
              ? 'public, max-age=60, s-maxage=300'
              : 'public, max-age=31536000, immutable',
          },
          customMetadata: {
            ...(sha256 ? { sha256 } : {}),
            ...(schemaVersion ? { schemaVersion } : {}),
            size: String(bytes.byteLength),
            managedBy: 'palta-local-data-production',
          },
        });

        return json({
          ok: true,
          key,
          bytes: bytes.byteLength,
          ...(sha256 ? { sha256 } : {}),
          ...(schemaVersion ? { schemaVersion } : {}),
        });
      }

      if (url.pathname === '/start' && request.method === 'POST') {
        const input = (await request.json()) as {
          key?: string;
          sha256?: string;
          size?: number;
        };
        if (!input.key) return json({ ok: false, error: 'key required' }, 400);

        const upload = await env.MAPS.createMultipartUpload(input.key, {
          httpMetadata: {
            contentType: 'application/vnd.pmtiles',
            cacheControl: 'public, max-age=31536000, immutable',
          },
          customMetadata: {
            ...(input.sha256 ? { sha256: input.sha256 } : {}),
            ...(Number.isFinite(input.size) ? { size: String(input.size) } : {}),
            managedBy: 'palta-map-production',
          },
        });

        return json({ ok: true, key: upload.key, uploadId: upload.uploadId });
      }

      if (url.pathname === '/part' && request.method === 'PUT') {
        const key = requiredHeader(request, 'x-palta-key');
        const uploadId = requiredHeader(request, 'x-palta-upload-id');
        const partNumber = Number(requiredHeader(request, 'x-palta-part-number'));
        if (!Number.isInteger(partNumber) || partNumber < 1) {
          return json({ ok: false, error: 'invalid part number' }, 400);
        }
        if (!request.body) return json({ ok: false, error: 'body required' }, 400);

        const upload = env.MAPS.resumeMultipartUpload(key, uploadId);
        const part = await upload.uploadPart(partNumber, request.body);
        return json({ ok: true, partNumber: part.partNumber, etag: part.etag });
      }

      if (url.pathname === '/complete' && request.method === 'POST') {
        const input = (await request.json()) as {
          key?: string;
          uploadId?: string;
          parts?: R2UploadedPart[];
        };
        if (!input.key || !input.uploadId || !Array.isArray(input.parts)) {
          return json({ ok: false, error: 'key, uploadId and parts required' }, 400);
        }

        const upload = env.MAPS.resumeMultipartUpload(input.key, input.uploadId);
        await upload.complete(input.parts);
        return json({ ok: true, key: input.key, parts: input.parts.length });
      }

      if (url.pathname === '/abort' && request.method === 'POST') {
        const input = (await request.json()) as { key?: string; uploadId?: string };
        if (!input.key || !input.uploadId) {
          return json({ ok: false, error: 'key and uploadId required' }, 400);
        }
        const upload = env.MAPS.resumeMultipartUpload(input.key, input.uploadId);
        await upload.abort();
        return json({ ok: true });
      }

      return json({ ok: false, error: 'not found', path: url.pathname }, 404);
    } catch (error) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'upload error',
          path: url.pathname,
        },
        500,
      );
    }
  },
};
