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

let sequence = 0;
function makeJob(kind: 'receipt' | 'kitchen_ticket' = 'receipt') {
  sequence += 1;
  const content: PrintContent = { kind, lines: [{ text: 'Test' }] };
  return createPrintJob({
    id: `job-${kind}-${sequence}`,
    businessId: 'biz-1',
    printerId: 'printer-1',
    content,
    idempotencyKey: `idem-${kind}-${sequence}`,
    createdAt: '2026-09-17T19:00:00Z',
  });
}

const queued = makeJob();
const dispatching = beginPrintDispatch(queued, '2026-09-17T19:00:01Z');
assertEqual(dispatching.status, 'dispatching', 'Queued job must enter dispatching.');
assertEqual(dispatching.retryAuthorized, false, 'Initial dispatch must not carry retry authorization.');

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
assertEqual(submitted.providerJobId, 'provider-1', 'Provider job reference must survive for reconciliation.');
assertEqual(submitted.retryAuthorized, false, 'Submitted output must never authorize retry.');
assertThrows(
  () => beginPrintDispatch(submitted, '2026-09-17T19:00:03Z'),
  'Submitted job may already have printed and must not be blindly re-dispatched.',
);
assertThrows(
  () => beginPrintRetry(submitted, '2026-09-17T19:00:04Z'),
  'Submitted job must not use the retry path either.',
);

const unknownSource = beginPrintDispatch(makeJob('kitchen_ticket'), '2026-09-17T19:01:01Z');
const unknown = applyPrintDispatchResult(
  unknownSource,
  { outcome: 'unknown', code: 'socket_closed_after_write' },
  '2026-09-17T19:01:02Z',
);
assertEqual(unknown.status, 'outcome_unknown', 'Ambiguous kitchen output must stay outcome_unknown.');
assertEqual(unknown.retryAuthorized, false, 'Ambiguous output must never authorize retry.');
assertThrows(
  () => beginPrintDispatch(unknown, '2026-09-17T19:01:03Z'),
  'Unknown kitchen ticket must not auto-reprint and risk duplicate preparation.',
);
assertThrows(
  () => beginPrintRetry(unknown, '2026-09-17T19:01:04Z'),
  'Unknown kitchen ticket must reconcile before any reprint.',
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
assertEqual(failed.retryAuthorized, true, 'Definitive no-output failure must persist retry authorization.');
assertThrows(
  () => beginPrintDispatch(failed, '2026-09-17T19:02:03Z'),
  'Failed jobs must use the explicit retry path, never initial dispatch.',
);

const retried = beginPrintRetry(failed, '2026-09-17T19:02:04Z');
assertEqual(retried.status, 'dispatching', 'Persisted retryable failure may use explicit retry.');
assertEqual(retried.retryAuthorized, false, 'Retry authorization must be consumed when retry begins.');
assert(retried.revision === failed.revision + 1, 'Retry must advance job revision.');

const nonRetryableSource = beginPrintDispatch(makeJob(), '2026-09-17T19:02:10Z');
const nonRetryableFailure: PrintDispatchResult = {
  outcome: 'failed',
  code: 'unsupported_media',
  retryable: false,
};
const nonRetryable = applyPrintDispatchResult(
  nonRetryableSource,
  nonRetryableFailure,
  '2026-09-17T19:02:11Z',
);
assertEqual(nonRetryable.retryAuthorized, false, 'Non-retryable failure must persist retry denial.');
assertThrows(
  () => beginPrintRetry(nonRetryable, '2026-09-17T19:02:12Z'),
  'Non-retryable failures must not auto retry.',
);

const printedSource = beginPrintDispatch(makeJob(), '2026-09-17T19:03:01Z');
const printed = applyPrintDispatchResult(
  printedSource,
  { outcome: 'printed' },
  '2026-09-17T19:03:02Z',
);
assertEqual(printed.retryAuthorized, false, 'Printed job must not authorize retry.');
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
