export type CustomerDeliveryChannel =
  | 'palta_inbox'
  | 'whatsapp_handoff'
  | 'whatsapp_business'
  | 'system_share'
  | 'sms'
  | 'email'
  | 'qr';

export type CustomerDeliveryDestination = {
  customerId?: string;
  paltaUserId?: string;
  phoneE164?: string;
  email?: string;
};

export type CustomerDeliveryPayload = {
  deliveryId: string;
  businessId: string;
  channel: CustomerDeliveryChannel;
  destination: CustomerDeliveryDestination;
  title: string;
  message?: string;
  secureLink?: string;
};

export type CustomerDeliveryAdapterResult =
  | { outcome: 'handed_off'; providerReference?: string }
  | { outcome: 'queued'; providerReference?: string }
  | { outcome: 'sent'; providerReference?: string }
  | { outcome: 'delivered'; providerReference?: string }
  | { outcome: 'unknown'; code: string; providerReference?: string }
  | { outcome: 'failed'; code: string; retryable: boolean };

export interface CustomerDeliveryPort {
  readonly channel: CustomerDeliveryChannel;
  deliver(payload: CustomerDeliveryPayload): Promise<CustomerDeliveryAdapterResult>;
}
