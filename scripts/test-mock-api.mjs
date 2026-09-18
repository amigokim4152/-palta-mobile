import { spawn } from 'node:child_process';
import net from 'node:net';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate mock API test port.'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Mock API exited before health check (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Timed out waiting for mock API health endpoint.');
}

function runSmoke(baseUrl) {
  return new Promise((resolve, reject) => {
    const smoke = spawn(process.execPath, ['dev/mock-api/smoke.mjs'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PALTA_MOCK_BASE_URL: baseUrl,
      },
    });
    smoke.on('error', reject);
    smoke.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Mock smoke failed (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`));
    });
  });
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dev/mock-api/server.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PALTA_MOCK_HOST: '127.0.0.1',
    PALTA_MOCK_PORT: String(port),
  },
});

let stderr = '';
server.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});
server.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

try {
  await waitForHealth(baseUrl, server);
  await runSmoke(baseUrl);
  console.log('PASS: functional mock API server + HTTP smoke');
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2_000);
      server.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  if (server.exitCode && stderr) {
    process.stderr.write(stderr);
  }
}
