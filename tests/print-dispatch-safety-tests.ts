import {
  applyPrintDispatchResult,
  beginPrintDispatch,
  beginPrintRetry,
  createPrintJob,
  type PrintContent,
  type PrintDispatchResult,
} from '../src/printing/printCore.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message);
}

function makeJob(kind: 'receipt' | 'kitchen_ticket' = 'receipt') {
  const content: PrintContent = { kind, lines: [{ text: 'Test' }] };
  return createPrintJob({
    id: `job-${kind}`,
    businessId: 'biz-1',
    printerId: 'printer-1',
    content,
    idempotencyKey: `idem-${kind}`,
    createdAt: '2026-09-17T19:00:00Z',
  });
}

const queued = makeJob();
const dispatching = beginPrintDispatch(queued, '2026-09-17T19:00:01Z');
assertEqual(dispatching.status, 'dispatching', 'Queued job must enter dispatching.');

assertThrows(
  () => beginPrintDispatch(dispatching, '2026-09-17T19:00:02Z'),
  'Dispatching job must not be blindly dispatched twice.',
);

const submitted = applyPrintDispatchResult(
  dispatching,
  { outcome: 'submitted', providerJobId: 'provider-1' },
  '2026-09-17T19:00:02Z',
);
assertEqual(submitted.status, 'submitted', 'Submitted outcome must remain explicit.');
assertThrows(
  () => beginPrintDispatch(submitted, '2026-09-17T19:00:03Z'),
  'Submitted job may already have printed and must not be blindly re-dispatched.',
);

const unknownSource = beginPrintDispatch(makeJob('kitchen_ticket'), '2026-09-17T19:01:01Z');
const unknown = applyPrintDispatchResult(
  unknownSource,
  { outcome: 'unknown', code: 'socket_closed_after_write' },
  '2026-09-17T19:01:02Z',
);
assertEqual(unknown.status, 'outcome_unknown', 'Ambiguous kitchen output must stay outcome_unknown.');
assertThrows(
  () => beginPrintDispatch(unknown, '2026-09-17T19:01:03Z'),
  'Unknown kitchen ticket must not auto-reprint and risk duplicate preparation.',
);

const failedSource = beginPrintDispatch(makeJob(), '2026-09-17T19:02:01Z');
const retryableFailure: PrintDispatchResult = {
  outcome: 'failed',
  code: 'printer_offline_before_write',
  retryable: true,
};
const failed = applyPrintDispatchResult(
  failedSource,
  retryableFailure,
  '2026-09-17T19:02:02Z',
);
assertEqual(failed.status, 'failed', 'Definitive failed outcome must be retained.');
assertThrows(
  () => beginPrintDispatch(failed, '2026-09-17T19:02:03Z'),
  'Failed jobs must use the explicit retry path, never initial dispatch.',
);

const retried = beginPrintRetry(failed, retryableFailure, '2026-09-17T19:02:04Z');
assertEqual(retried.status, 'dispatching', 'Definitive retryable failure may use explicit retry.');
assert(retried.revision === failed.revision + 1, 'Retry must advance job revision.');

const nonRetryableFailure: PrintDispatchResult = {
  outcome: 'failed',
  code: 'unsupported_media',
  retryable: false,
};
assertThrows(
  () => beginPrintRetry(failed, nonRetryableFailure, '2026-09-17T19:02:05Z'),
  'Non-retryable failures must not auto retry.',
);
assertThrows(
  () => beginPrintRetry(failed, { outcome: 'unknown', code: 'ambiguous' }, '2026-09-17T19:02:06Z'),
  'Ambiguous output can never authorize automatic retry.',
);

const printedSource = beginPrintDispatch(makeJob(), '2026-09-17T19:03:01Z');
const printed = applyPrintDispatchResult(
  printedSource,
  { outcome: 'printed' },
  '2026-09-17T19:03:02Z',
);
assertThrows(
  () => beginPrintDispatch(printed, '2026-09-17T19:03:03Z'),
  'Printed jobs must never be dispatched again as the same job.',
);

const cancelled = { ...makeJob(), status: 'cancelled' as const };
assertThrows(
  () => beginPrintDispatch(cancelled, '2026-09-17T19:04:00Z'),
  'Cancelled jobs must never dispatch.',
);

console.log('print-dispatch-safety-tests: ok');
