import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = process.env.PALTA_MOCK_VERIFY_PORT ?? '18787';
const baseUrl = `http://${host}:${port}`;

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error('Mock API did not become healthy.');
}

const server = spawn(process.execPath, ['dev/mock-api/server.mjs'], {
  env: {
    ...process.env,
    PALTA_MOCK_HOST: host,
    PALTA_MOCK_PORT: port,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForHealth();

  const smoke = spawn(process.execPath, ['dev/mock-api/smoke.mjs'], {
    env: {
      ...process.env,
      PALTA_MOCK_BASE_URL: baseUrl,
    },
    stdio: 'inherit',
  });
  const result = await waitForExit(smoke);
  if (result.code !== 0) {
    throw new Error(
      `Mock smoke exited with code ${String(result.code)} signal ${String(result.signal)}`,
    );
  }
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  if (!server.killed) server.kill('SIGTERM');
  await Promise.race([
    waitForExit(server),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}
