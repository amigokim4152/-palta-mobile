import {
  markPaymentConnectionVerified,
  paymentConnectionCanPerformExternalOperation,
  provisionPaymentCredentialReference,
  transitionPaymentProviderConnection,
  type PaymentProviderConnection,
} from '../src/payment/paymentProviderConnection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const draft: PaymentProviderConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  providerKey: 'mercadopago_point',
  environment: 'sandbox',
  status: 'draft',
  capabilities: {},
  safeConfiguration: {},
  revision: 0,
  createdAt: '2026-09-17T18:30:00.000Z',
  updatedAt: '2026-09-17T18:30:00.000Z',
};

const pending = transitionPaymentProviderConnection(
  draft,
  'pending_credentials',
  '2026-09-17T18:31:00.000Z',
);
assert(pending.status === 'pending_credentials' && pending.revision === 1, 'Draft connection must enter pending_credentials with one revision.');
assert(!paymentConnectionCanPerformExternalOperation(pending), 'Connection awaiting credentials must not call provider.');

let noCredentialTestingBlocked = false;
try {
  transitionPaymentProviderConnection(
    pending,
    'ready_for_test',
    '2026-09-17T18:32:00.000Z',
  );
} catch {
  noCredentialTestingBlocked = true;
}
assert(noCredentialTestingBlocked, 'Connection must not become testable before encrypted credential reference exists.');

const ready = provisionPaymentCredentialReference(pending, {
  credentialRef: 'credential://business-a/mp/1',
  merchantRef: 'MP-MERCHANT-A',
  occurredAt: '2026-09-17T18:32:00.000Z',
});
assert(ready.status === 'ready_for_test' && ready.revision === 2, 'Credential provisioning must enter ready_for_test in exactly one revision.');
assert(paymentConnectionCanPerformExternalOperation(ready), 'ready_for_test connection with credentials may execute controlled sandbox test.');
assert(
  !paymentConnectionCanPerformExternalOperation(ready, 'production'),
  'Sandbox connection must never execute in production runtime.',
);

const testing = transitionPaymentProviderConnection(
  ready,
  'testing',
  '2026-09-17T18:33:00.000Z',
);
const verified = markPaymentConnectionVerified(
  testing,
  '2026-09-17T18:33:30.000Z',
);
const connected = transitionPaymentProviderConnection(
  verified,
  'connected',
  '2026-09-17T18:34:00.000Z',
);
assert(connected.status === 'connected', 'Verified testing connection must be able to become connected.');
assert(connected.lastVerifiedAt === '2026-09-17T18:33:30.000Z', 'Provider verification evidence timestamp must be preserved.');
assert(paymentConnectionCanPerformExternalOperation(connected), 'Connected sandbox provider connection must be executable in sandbox.');
assert(
  !paymentConnectionCanPerformExternalOperation(connected, 'production'),
  'Connected sandbox credentials must still be blocked in production runtime.',
);

const productionReady: PaymentProviderConnection = {
  ...ready,
  environment: 'production',
};
assert(
  !paymentConnectionCanPerformExternalOperation(productionReady, 'production'),
  'Production runtime must reject ready_for_test connections even when credentials exist.',
);

const productionConnected: PaymentProviderConnection = {
  ...connected,
  environment: 'production',
};
assert(
  paymentConnectionCanPerformExternalOperation(productionConnected, 'production'),
  'Production runtime may execute only a production connection in connected state.',
);

const paused = transitionPaymentProviderConnection(
  connected,
  'paused',
  '2026-09-17T18:35:00.000Z',
);
assert(!paymentConnectionCanPerformExternalOperation(paused), 'Paused provider connection must immediately block provider side effects.');

let invalidSkipBlocked = false;
try {
  transitionPaymentProviderConnection(
    draft,
    'connected',
    '2026-09-17T18:36:00.000Z',
  );
} catch {
  invalidSkipBlocked = true;
}
assert(invalidSkipBlocked, 'Provider connection must not skip onboarding/testing directly from draft to connected.');

let rawCredentialBlocked = false;
try {
  provisionPaymentCredentialReference(pending, {
    credentialRef: 'Bearer SHOULD-NOT-BE-HERE',
    occurredAt: '2026-09-17T18:37:00.000Z',
  });
} catch {
  rawCredentialBlocked = true;
}
assert(rawCredentialBlocked, 'Canonical provider connection must reject obvious raw bearer credential material.');

console.log('PASS: payment provider connection lifecycle safety tests');
