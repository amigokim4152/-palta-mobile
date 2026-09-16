import { PaltaApiError } from './paltaApiClient.js';

export function isRetryableMutationError(error: unknown): boolean {
  if (error instanceof PaltaApiError) {
    return (
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    );
  }

  // fetch() network failures are commonly surfaced as TypeError in JS runtimes.
  if (error instanceof TypeError) return true;

  return false;
}

export function createClientMutationId(
  nowMs: number,
  randomValue: number,
): string {
  const safeRandom = Math.max(0, Math.min(0.999999999999, randomValue));
  const randomPart = Math.floor(safeRandom * 1_000_000_000)
    .toString(36)
    .padStart(6, '0');
  return `m-${nowMs.toString(36)}-${randomPart}`;
}
