import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handleBusinessQuotesRequest } from './business-quotes-state.mjs';
import { handleBusinessReservationsRequest } from './business-reservations-state.mjs';
import { demoBusinesses } from './local-business-demo-fixtures.mjs';

const host = process.env.PALTA_MOCK_HOST ?? '127.0.0.1';
const port = Number(process.env.PALTA_MOCK_PORT ?? '8787');
const upstreamPort = port + 10000;
const businesses = structuredClone(demoBusinesses);

function json(res, status, body) {
  const payload = JSON.stringify(body);
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

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function proxyToBase(req, res) {
  const upstream = http.request(
    {
      hostname: host,
      port: upstreamPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${host}:${upstreamPort}`,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) json(res, 502, { error: 'mock_base_unavailable' });
    else res.end();
  });
  req.pipe(upstream);
}

const baseServerPath = fileURLToPath(new URL('./server.mjs', import.meta.url));
const child = spawn(process.execPath, [baseServerPath], {
  env: {
    ...process.env,
    PALTA_MOCK_HOST: host,
    PALTA_MOCK_PORT: String(upstreamPort),
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { error: 'bad_request' });
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);

    const quoteHandled = await handleBusinessQuotesRequest({
      req,
      res,
      url,
      businesses,
      json,
      readJson,
    });
    if (quoteHandled) return;

    const reservationHandled = await handleBusinessReservationsRequest({
      req,
      res,
      url,
      businesses,
      json,
      readJson,
    });
    if (reservationHandled) return;

    proxyToBase(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) return json(res, 500, { error: 'internal_error' });
    res.end();
  }
});

server.listen(port, host, () => {
  console.log(`Palta composed mock API listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => {
    if (!child.killed) child.kill('SIGTERM');
    process.exit(0);
  });
}

child.on('exit', (code) => {
  if (code && code !== 0) console.error(`Base mock API exited with code ${code}`);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
