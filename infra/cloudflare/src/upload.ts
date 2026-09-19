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
};

type Env = {
  MAPS: R2BucketLike;
  UPLOAD_TOKEN: string;
};

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'palta-map-uploader' });
    }

    if (!authOk(request, env)) return unauthorized();

    try {
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
