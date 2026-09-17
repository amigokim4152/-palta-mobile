import type { PaymentProviderConnection } from './paymentProviderConnection.js';

/**
 * Canonical payment-connection capability keys for debit/credit/prepaid UX.
 *
 * Exactly one mode should be configured for an integrated card terminal. Palta
 * must not infer a mode from provider name or from what another terminal model
 * happened to support.
 */
export const CARD_FUNDING_CAPABILITIES = {
  autoDetect: 'card_funding_auto_detect',
  paltaSelection: 'card_funding_selection_by_palta',
  externalTerminalSelection: 'card_funding_selection_on_terminal',
} as const;

export type CardFundingInteractionMode =
  | 'automatic'
  | 'palta_selection'
  | 'external_terminal_selection'
  | 'configuration_required';

export type CardFundingInteractionPlan = {
  mode: CardFundingInteractionMode;
  /** Whether Palta itself should render a debit/credit/prepaid choice. */
  showPaltaFundingChoice: boolean;
  /** Whether Palta can initiate the integrated card operation without a funding choice. */
  canStartIntegratedPayment: boolean;
  /**
   * True when a legacy/standalone terminal owns the funding selection UX. Palta
   * must not duplicate that question on the cashier screen.
   */
  preserveExternalTerminalFlow: boolean;
};

function enabled(connection: PaymentProviderConnection, key: string): boolean {
  return connection.capabilities[key] === true;
}

/**
 * Resolve the least-intrusive safe cashier flow for a connected card terminal.
 *
 * Product rule:
 * - if the provider/terminal detects funding type, never ask the cashier;
 * - if Palta must supply the choice to the integration, ask exactly once in Palta;
 * - if a standalone/legacy terminal owns the choice, do not ask again in Palta;
 * - if capability is unknown, fail closed for integrated control rather than
 *   pretending automatic detection or forcing an arbitrary debit/credit choice.
 */
export function resolveCardFundingInteraction(
  connection: PaymentProviderConnection,
): CardFundingInteractionPlan {
  const autoDetect = enabled(connection, CARD_FUNDING_CAPABILITIES.autoDetect);
  const paltaSelection = enabled(connection, CARD_FUNDING_CAPABILITIES.paltaSelection);
  const externalTerminalSelection = enabled(
    connection,
    CARD_FUNDING_CAPABILITIES.externalTerminalSelection,
  );

  const enabledModes = [autoDetect, paltaSelection, externalTerminalSelection].filter(Boolean).length;
  if (enabledModes > 1) {
    throw new Error(
      'Payment connection has conflicting card-funding interaction capabilities.',
    );
  }

  if (autoDetect) {
    return {
      mode: 'automatic',
      showPaltaFundingChoice: false,
      canStartIntegratedPayment: true,
      preserveExternalTerminalFlow: false,
    };
  }

  if (paltaSelection) {
    return {
      mode: 'palta_selection',
      showPaltaFundingChoice: true,
      canStartIntegratedPayment: false,
      preserveExternalTerminalFlow: false,
    };
  }

  if (externalTerminalSelection) {
    return {
      mode: 'external_terminal_selection',
      showPaltaFundingChoice: false,
      canStartIntegratedPayment: true,
      preserveExternalTerminalFlow: true,
    };
  }

  return {
    mode: 'configuration_required',
    showPaltaFundingChoice: false,
    canStartIntegratedPayment: false,
    preserveExternalTerminalFlow: false,
  };
}
