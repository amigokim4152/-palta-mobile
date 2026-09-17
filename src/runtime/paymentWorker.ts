import {
  PaymentOutboxHandler,
  StaticPaymentPortResolver,
  type PaymentWorkerIdFactory,
} from '../payment/paymentOutboxHandler.js';
import type { PaymentRepository } from '../persistence/paymentRepository.js';
import type { OutboxRepository } from '../persistence/outboxRepository.js';
import type { PaymentPort } from '../ports/paymentPort.js';
import {
  consumeOutboxQueueMessage,
  type OutboxConsumerResult,
} from './outboxConsumer.js';

export type PaymentWorkerRuntimeInput = {
  rawMessage: unknown;
  outboxRepository: OutboxRepository;
  paymentRepository: PaymentRepository;
  paymentPorts: readonly PaymentPort[];
  ids: PaymentWorkerIdFactory;
  workerId: string;
  now: () => string;
  leaseSeconds?: number;
};

function leaseExpiry(now: string, seconds: number): string {
  const start = Date.parse(now);
  if (Number.isNaN(start)) throw new Error('Payment Worker now must be a valid timestamp.');
  if (!Number.isSafeInteger(seconds) || seconds < 5 || seconds > 300) {
    throw new Error('Payment Worker leaseSeconds must be an integer between 5 and 300.');
  }
  return new Date(start + seconds * 1000).toISOString();
}

/**
 * Provider-neutral Payment Worker composition root.
 *
 * Runtime-specific adapters (Cloudflare Workers today, another runtime later)
 * inject repositories, provider ports, IDs and clock. This function owns no
 * Cloudflare, Supabase, Hyperdrive or provider SDK dependency.
 */
export async function processPaymentQueueMessage(
  input: PaymentWorkerRuntimeInput,
): Promise<OutboxConsumerResult> {
  if (!input.workerId.trim()) throw new Error('Payment Worker workerId is required.');
  if (input.paymentPorts.length === 0) {
    throw new Error('Payment Worker requires at least one configured payment provider port.');
  }

  const now = input.now();
  const leaseSeconds = input.leaseSeconds ?? 30;
  const handler = new PaymentOutboxHandler(
    input.paymentRepository,
    new StaticPaymentPortResolver(input.paymentPorts),
    input.ids,
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
