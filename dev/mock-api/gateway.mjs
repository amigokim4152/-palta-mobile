import http from 'node:http';
import { handleRealEstateRequest } from './real-estate-state.mjs';

const host = process.env.PALTA_MOCK_HOST ?? '127.0.0.1';
const publicPort = Number(process.env.PALTA_MOCK_PORT ?? '8787');
const backendPort = Number(process.env.PALTA_MOCK_BACKEND_PORT ?? String(publicPort + 10000));

if (!Number.isFinite(publicPort) || !Number.isFinite(backendPort) || publicPort === backendPort) {
  throw new Error('PALTA mock gateway requires two distinct valid ports.');
}

const previousPort = process.env.PALTA_MOCK_PORT;
process.env.PALTA_MOCK_PORT = String(backendPort);
await import('./server.mjs');
if (previousPort === undefined) delete process.env.PALTA_MOCK_PORT;
else process.env.PALTA_MOCK_PORT = previousPort;

function json(res, status, body) {
  const payload = status === 204 ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  });
  res.end(payload);
}

async function waitForBackend() {
  const healthUrl = `http://127.0.0.1:${backendPort}/health`;
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw lastError ?? new Error('Palta mock backend did not become ready.');
}

await waitForBackend();

const gateway = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { error: 'bad_request' });
    const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${publicPort}`}`);

    if (req.method === 'OPTIONS' && url.pathname.startsWith('/v1/real-estate/')) {
      return json(res, 204, {});
    }

    if (await handleRealEstateRequest({ req, res, url, json })) return;

    const proxyRequest = http.request(
      {
        hostname: '127.0.0.1',
        port: backendPort,
        method: req.method,
        path: req.url,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${backendPort}`,
        },
      },
      (proxyResponse) => {
        res.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
        proxyResponse.pipe(res);
      },
    );

    proxyRequest.on('error', (error) => {
      console.error('Palta mock gateway proxy error', error);
      if (!res.headersSent) json(res, 502, { error: 'mock_backend_unavailable' });
      else res.destroy(error);
    });

    req.pipe(proxyRequest);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) return json(res, 500, { error: 'internal_error' });
    res.destroy(error instanceof Error ? error : undefined);
  }
});

gateway.listen(publicPort, host, () => {
  console.log(`Palta mock gateway listening on http://${host}:${publicPort} -> backend ${backendPort}`);
});
