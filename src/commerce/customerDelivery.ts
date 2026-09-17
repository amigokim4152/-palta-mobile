import type {
  CustomerDeliveryAdapterResult,
  CustomerDeliveryChannel,
  CustomerDeliveryDestination,
} from '../ports/customerDeliveryPort.js';

export type CustomerDeliveryPurpose =
  | 'transactional'
  | 'service_follow_up'
  | 'marketing';

export type CustomerArtifactKind =
  | 'receipt'
  | 'fiscal_document'
  | 'order_status'
  | 'pickup_code'
  | 'quote_summary'
  | 'service_summary';

export type CustomerArtifact = {
  id: string;
  businessId: string;
  kind: CustomerArtifactKind;
  sourceId: string;
  /** Human-safe summary. Full sensitive/fiscal content stays behind secure access. */
  title: string;
  secureLinkRef?: string;
  expiresAt?: string;
};

export type CustomerContactPermission = {
  customerId: string;
  transactionalAllowed: boolean;
  serviceFollowUpAllowed: boolean;
  marketingAllowed: boolean;
  allowedChannels: ReadonlySet<CustomerDeliveryChannel>;
};

export type CustomerDeliveryStatus =
  | 'prepared'
  | 'handed_off'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'unknown'
  | 'failed';

export type CustomerDelivery = {
  id: string;
  businessId: string;
  customerId?: string;
  artifactId: string;
  purpose: CustomerDeliveryPurpose;
  channel: CustomerDeliveryChannel;
  destination: CustomerDeliveryDestination;
  status: CustomerDeliveryStatus;
  idempotencyKey: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  providerReference?: string;
  errorCode?: string;
};

export type CustomerRelationshipTouchpoint = {
  id: string;
  businessId: string;
  customerId: string;
  type: 'transactional_delivery' | 'service_follow_up' | 'marketing_contact';
  artifactKind: CustomerArtifactKind;
  sourceId: string;
  deliveryId: string;
  occurredAt: string;
  /** A touchpoint records history. It never grants future messaging permission. */
  grantsFuturePermission: false;
};

export function purposeAllowed(
  purpose: CustomerDeliveryPurpose,
  permission: CustomerContactPermission | undefined,
  channel: CustomerDeliveryChannel,
): boolean {
  // A guest/customer may explicitly request a one-off transactional receipt even
  // before a durable CRM permission record exists. Marketing never gets this path.
  if (!permission) return purpose === 'transactional';
  if (permission.customerId.trim().length === 0) return false;
  if (!permission.allowedChannels.has(channel)) return false;
  if (purpose === 'transactional') return permission.transactionalAllowed;
  if (purpose === 'service_follow_up') return permission.serviceFollowUpAllowed;
  return permission.marketingAllowed;
}

export function createCustomerArtifact(input: CustomerArtifact): CustomerArtifact {
  if (!input.id.trim() || !input.businessId.trim() || !input.sourceId.trim() || !input.title.trim()) {
    throw new Error('Customer artifact id, businessId, sourceId and title are required.');
  }
  return { ...input };
}

export function createCustomerDelivery(input: {
  id: string;
  businessId: string;
  artifact: CustomerArtifact;
  purpose: CustomerDeliveryPurpose;
  channel: CustomerDeliveryChannel;
  destination: CustomerDeliveryDestination;
  idempotencyKey: string;
  createdAt: string;
  customerId?: string;
  permission?: CustomerContactPermission;
}): CustomerDelivery {
  if (!input.id.trim() || !input.businessId.trim() || !input.idempotencyKey.trim()) {
    throw new Error('Customer delivery id, businessId and idempotencyKey are required.');
  }
  if (input.artifact.businessId !== input.businessId) {
    throw new Error('Customer artifact belongs to another business.');
  }
  if (!purposeAllowed(input.purpose, input.permission, input.channel)) {
    throw new Error('Customer contact permission does not allow this delivery purpose/channel.');
  }
  if (input.customerId !== undefined && input.permission && input.permission.customerId !== input.customerId) {
    throw new Error('Customer contact permission belongs to another customer.');
  }
  assertDestinationFitsChannel(input.channel, input.destination);

  const delivery: CustomerDelivery = {
    id: input.id,
    businessId: input.businessId,
    artifactId: input.artifact.id,
    purpose: input.purpose,
    channel: input.channel,
    destination: { ...input.destination },
    status: 'prepared',
    idempotencyKey: input.idempotencyKey,
    revision: 0,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  if (input.customerId !== undefined) delivery.customerId = input.customerId;
  return delivery;
}

function assertDestinationFitsChannel(
  channel: CustomerDeliveryChannel,
  destination: CustomerDeliveryDestination,
): void {
  if (channel === 'palta_inbox' && !destination.paltaUserId?.trim()) {
    throw new Error('Palta inbox delivery requires paltaUserId.');
  }
  if (
    (channel === 'whatsapp_handoff' || channel === 'whatsapp_business' || channel === 'sms') &&
    !destination.phoneE164?.trim()
  ) {
    throw new Error(`${channel} delivery requires an E.164 phone number.`);
  }
  if (channel === 'email' && !destination.email?.trim()) {
    throw new Error('Email delivery requires an email address.');
  }
  if (channel === 'system_share' || channel === 'qr') return;
}

export function applyCustomerDeliveryResult(
  delivery: CustomerDelivery,
  result: CustomerDeliveryAdapterResult,
  updatedAt: string,
): CustomerDelivery {
  if (delivery.status === 'delivered') return delivery;

  const base = {
    ...delivery,
    revision: delivery.revision + 1,
    updatedAt,
  };

  if (result.outcome === 'handed_off') {
    return withProviderRef({ ...base, status: 'handed_off' }, result.providerReference);
  }
  if (result.outcome === 'queued') {
    return withProviderRef({ ...base, status: 'queued' }, result.providerReference);
  }
  if (result.outcome === 'sent') {
    return withProviderRef({ ...base, status: 'sent' }, result.providerReference);
  }
  if (result.outcome === 'delivered') {
    return withProviderRef({ ...base, status: 'delivered' }, result.providerReference);
  }
  if (result.outcome === 'unknown') {
    const unknown = withProviderRef({ ...base, status: 'unknown' as const, errorCode: result.code }, result.providerReference);
    return unknown;
  }
  return {
    ...base,
    status: 'failed',
    errorCode: result.code,
  };
}

function withProviderRef<T extends CustomerDelivery>(
  delivery: T,
  providerReference: string | undefined,
): T {
  if (providerReference === undefined) return delivery;
  return { ...delivery, providerReference };
}

export function deliveryCreatesRelationshipTouchpoint(
  delivery: CustomerDelivery,
): boolean {
  return Boolean(delivery.customerId) && delivery.status !== 'prepared' && delivery.status !== 'failed';
}

export function createRelationshipTouchpoint(input: {
  id: string;
  delivery: CustomerDelivery;
  artifact: CustomerArtifact;
  occurredAt: string;
}): CustomerRelationshipTouchpoint {
  const customerId = input.delivery.customerId;
  if (!customerId) throw new Error('Anonymous delivery cannot create a customer relationship touchpoint.');
  if (!deliveryCreatesRelationshipTouchpoint(input.delivery)) {
    throw new Error('Delivery has not reached a relationship-recordable state.');
  }
  if (input.delivery.artifactId !== input.artifact.id) {
    throw new Error('Delivery and customer artifact do not match.');
  }

  const type =
    input.delivery.purpose === 'transactional'
      ? 'transactional_delivery'
      : input.delivery.purpose === 'service_follow_up'
        ? 'service_follow_up'
        : 'marketing_contact';

  return {
    id: input.id,
    businessId: input.delivery.businessId,
    customerId,
    type,
    artifactKind: input.artifact.kind,
    sourceId: input.artifact.sourceId,
    deliveryId: input.delivery.id,
    occurredAt: input.occurredAt,
    grantsFuturePermission: false,
  };
}

/**
 * User-initiated channels (WhatsApp handoff/system share) cannot honestly claim
 * provider delivery. They are complete at `handed_off` unless a later provider
 * adapter supplies an authoritative receipt.
 */
export function isAuthoritativeDeliveryStatus(
  channel: CustomerDeliveryChannel,
  status: CustomerDeliveryStatus,
): boolean {
  if (channel === 'whatsapp_handoff' || channel === 'system_share') {
    return status === 'handed_off';
  }
  return status === 'delivered';
}
