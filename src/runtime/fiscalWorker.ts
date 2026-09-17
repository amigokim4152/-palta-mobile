import {
  ExternalFiscalOutboxHandler,
  type ExternalFiscalPortResolver,
} from '../fiscal/chile/fiscalOutboxHandler.js';
import type { FiscalExecutionRepository } from '../persistence/fiscalExecutionRepository.js';
import type { FiscalRequestRepository } from '../persistence/fiscalRequestRepository.js';
import type { OutboxRepository } from '../persistence/outboxRepository.js';
import {
  consumeOutboxQueueMessage,
  type OutboxConsumerResult,
} from './outboxConsumer.js';

export type FiscalWorkerRuntimeInput = {
  rawMessage: unknown;
  outboxRepository: OutboxRepository;
  fiscalExecutionRepository: FiscalExecutionRepository;
  fiscalRequestRepository: FiscalRequestRepository;
  fiscalPortResolver: ExternalFiscalPortResolver;
  workerId: string;
  now: () => string;
  leaseSeconds?: number;
};

function leaseExpiry(now: string, seconds: number): string {
  const start = Date.parse(now);
  if (Number.isNaN(start)) throw new Error('Fiscal Worker now must be a valid timestamp.');
  if (!Number.isSafeInteger(seconds) || seconds < 5 || seconds > 300) {
    throw new Error('Fiscal Worker leaseSeconds must be an integer between 5 and 300.');
  }
  return new Date(start + seconds * 1000).toISOString();
}

/**
 * Provider-neutral external Fiscal Worker composition root.
 *
 * Cloudflare/another queue runtime injects DB repositories and a business-scoped
 * fiscal provider resolver. Provider secrets and HTTP SDKs remain outside the
 * canonical domain/runtime core.
 */
export async function processFiscalQueueMessage(
  input: FiscalWorkerRuntimeInput,
): Promise<OutboxConsumerResult> {
  if (!input.workerId.trim()) throw new Error('Fiscal Worker workerId is required.');

  const now = input.now();
  const leaseSeconds = input.leaseSeconds ?? 45;
  const handler = new ExternalFiscalOutboxHandler(
    input.fiscalExecutionRepository,
    input.fiscalRequestRepository,
    input.fiscalPortResolver,
    input.now,
  );

  return consumeOutboxQueueMessage({
    rawMessage: input.rawMessage,
    repository: input.outboxRepository,
    handler,
    workerId: input.workerId,
    now,
    leaseExpiresAt: leaseExpiry(now, leaseSeconds),
  });
}
