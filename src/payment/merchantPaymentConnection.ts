export type MerchantPaymentConnectionStatus =
  | 'not_connected'
  | 'pending'
  | 'connected'
  | 'restricted'
  | 'disconnected';

export type MerchantPaymentConnection = {
  id: string;
  merchantId: string;
  providerKey: string;
  providerMerchantReference?: string;
  status: MerchantPaymentConnectionStatus;
  capabilities: {
    receivePayments: boolean;
    refunds: boolean;
    splitFees: boolean;
    settlements: boolean;
    accountToAccount: boolean;
  };
  connectedAt?: string;
  updatedAt: string;
};

/**
 * Canonical merchant identity stays in Palta.
 * Provider merchant IDs are external references only.
 */
export function canAcceptPayment(
  connection: MerchantPaymentConnection,
): boolean {
  return (
    connection.status === 'connected' &&
    connection.capabilities.receivePayments
  );
}
