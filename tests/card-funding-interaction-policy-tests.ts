import {
  CARD_FUNDING_CAPABILITIES,
  resolveCardFundingInteraction,
} from '../src/payment/cardFundingInteractionPolicy.js';
import type { PaymentProviderConnection } from '../src/payment/paymentProviderConnection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function connection(
  capabilities: Record<string, boolean>,
): PaymentProviderConnection {
  return {
    id: 'connection-1',
    businessId: 'business-1',
    providerKey: 'provider-1',
    environment: 'production',
    status: 'connected',
    credentialRef: 'secret://payment/connection-1',
    capabilities,
    safeConfiguration: {},
    revision: 1,
    createdAt: '2026-09-17T20:00:00-03:00',
    updatedAt: '2026-09-17T20:00:00-03:00',
  };
}

const automatic = resolveCardFundingInteraction(
  connection({ [CARD_FUNDING_CAPABILITIES.autoDetect]: true }),
);
assert(automatic.mode === 'automatic', 'Auto-detect terminals should use automatic mode.');
assert(
  automatic.showPaltaFundingChoice === false && automatic.canStartIntegratedPayment,
  'Auto-detect terminals must not ask the cashier for debit/credit before payment.',
);

const paltaSelection = resolveCardFundingInteraction(
  connection({ [CARD_FUNDING_CAPABILITIES.paltaSelection]: true }),
);
assert(
  paltaSelection.mode === 'palta_selection' && paltaSelection.showPaltaFundingChoice,
  'Only integrations that require Palta to supply funding type should show the choice in Palta.',
);
assert(
  paltaSelection.canStartIntegratedPayment === false,
  'Palta-controlled funding selection must be completed before starting that provider operation.',
);

const legacyExternal = resolveCardFundingInteraction(
  connection({ [CARD_FUNDING_CAPABILITIES.externalTerminalSelection]: true }),
);
assert(
  legacyExternal.mode === 'external_terminal_selection' &&
    legacyExternal.preserveExternalTerminalFlow &&
    !legacyExternal.showPaltaFundingChoice,
  'Legacy/standalone terminals must keep their own required debit/credit flow without a duplicate Palta question.',
);
assert(
  legacyExternal.canStartIntegratedPayment,
  'Palta may hand off the amount while the external terminal owns its required funding selection.',
);

const unknown = resolveCardFundingInteraction(connection({}));
assert(
  unknown.mode === 'configuration_required' && !unknown.canStartIntegratedPayment,
  'Unknown integrated terminal capability must fail closed instead of guessing automatic or cashier selection.',
);
assert(
  !unknown.showPaltaFundingChoice,
  'Missing capability data must not create an arbitrary debit/credit question in the cashier UI.',
);

let conflictRejected = false;
try {
  resolveCardFundingInteraction(
    connection({
      [CARD_FUNDING_CAPABILITIES.autoDetect]: true,
      [CARD_FUNDING_CAPABILITIES.externalTerminalSelection]: true,
    }),
  );
} catch {
  conflictRejected = true;
}
assert(
  conflictRejected,
  'A terminal connection cannot simultaneously claim automatic and external funding selection ownership.',
);

console.log('PASS: capability-based card funding interaction policy tests');
