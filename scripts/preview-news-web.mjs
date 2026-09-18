#!/usr/bin/env node
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repoRoot, 'news-web');
const host = '127.0.0.1';
const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const port = Number(
  portArgIndex >= 0 && args[portArgIndex + 1]
    ? args[portArgIndex + 1]
    : process.env.NEWS_PREVIEW_PORT || 8788,
);
const shouldOpen = !args.includes('--no-open');

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('NEWS PREVIEW ERROR: port must be an integer between 1024 and 65535.');
  process.exit(2);
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

function safeLocalPath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0] || '/');
  const requested = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.posix.normalize(requested).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) return null;
  const candidate = path.resolve(webRoot, normalized);
  if (candidate !== webRoot && !candidate.startsWith(`${webRoot}${path.sep}`)) return null;
  return candidate;
}

function openBrowser(url) {
  const commands =
    process.platform === 'darwin'
      ? [['open', [url]]]
      : process.platform === 'win32'
        ? [['cmd', ['/c', 'start', '', url]]]
        : [['xdg-open', [url]], ['gio', ['open', url]]];

  for (const [command, commandArgs] of commands) {
    try {
      const child = spawn(command, commandArgs, { stdio: 'ignore', detached: true });
      child.unref();
      return;
    } catch {
      // Try the next platform opener. Preview remains usable without automatic opening.
    }
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url || (request.method !== 'GET' && request.method !== 'HEAD')) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }

    const candidate = safeLocalPath(request.url);
    if (!candidate) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Bad Request');
      return;
    }

    let target = candidate;
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = path.join(target, 'index.html');
    const targetInfo = await stat(target).catch(() => null);
    if (!targetInfo?.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    const ext = path.extname(target).toLowerCase();
    const headers = {
      'Content-Type': mime.get(ext) || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (request.method === 'HEAD') {
      response.writeHead(200, headers);
      response.end();
      return;
    }

    const body = await readFile(target);
    response.writeHead(200, { ...headers, 'Content-Length': String(body.length) });
    response.end(body);
  } catch (error) {
    console.error('NEWS PREVIEW REQUEST ERROR:', error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Internal Server Error');
  }
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`NEWS PREVIEW ERROR: ${host}:${port} is already in use.`);
  } else {
    console.error('NEWS PREVIEW ERROR:', error);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  const base = `http://${host}:${port}`;
  console.log('Palta News Web local preview');
  console.log(`Home       ${base}/`);
  console.log(`Comuna     ${base}/comuna.html`);
  console.log(`Story      ${base}/story.html?slug=demo-trabajos-viales-tramo-local`);
  console.log(`Deep Dive  ${base}/deep-dive.html?slug=demo-cuando-un-problema-se-repite`);
  console.log(`Voces      ${base}/voices.html`);
  console.log('Mode       localhost => mock only; no public publication');
  console.log('Stop       Ctrl+C');
  if (shouldOpen) openBrowser(`${base}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
