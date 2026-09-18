import type {
  CustomerArtifact,
  CustomerDelivery,
} from '../commerce/customerDelivery.js';

export type CustomerDeliveryPresentationDecision = {
  createHomeLifecycleItem: false;
  createPaltaInboxNotification: boolean;
  operatorAttentionRequired: boolean;
  reason:
    | 'transport_state_not_lifecycle_state'
    | 'palta_inbox_artifact_delivered'
    | 'external_channel_delivery'
    | 'delivery_failure_is_operator_concern'
    | 'marketing_not_home_state';
};

/**
 * CustomerDelivery is a transport/envelope state for customer-facing artifacts
 * such as receipts, order-status messages and quote summaries. It is not a
 * physical shipment lifecycle and must never be rendered as "delivery in
 * progress" on Personal Home.
 *
 * The owning domain (Commerce order, Care, future Logistics shipment, etc.)
 * projects lifecycle state into Home. CustomerDelivery may only result in an
 * Inbox notification when the artifact itself is authoritatively available in
 * Palta Inbox.
 */
export function decideCustomerDeliveryPresentation(input: {
  delivery: CustomerDelivery;
  artifact: CustomerArtifact;
}): CustomerDeliveryPresentationDecision {
  const { delivery, artifact } = input;

  if (delivery.artifactId !== artifact.id) {
    throw new Error('CustomerDelivery and CustomerArtifact do not match.');
  }
  if (delivery.businessId !== artifact.businessId) {
    throw new Error('CustomerDelivery and CustomerArtifact belong to different businesses.');
  }

  if (delivery.purpose === 'marketing') {
    return {
      createHomeLifecycleItem: false,
      createPaltaInboxNotification: false,
      operatorAttentionRequired: false,
      reason: 'marketing_not_home_state',
    };
  }

  if (delivery.status === 'failed' || delivery.status === 'unknown') {
    return {
      createHomeLifecycleItem: false,
      createPaltaInboxNotification: false,
      operatorAttentionRequired: true,
      reason: 'delivery_failure_is_operator_concern',
    };
  }

  if (delivery.channel !== 'palta_inbox') {
    return {
      createHomeLifecycleItem: false,
      createPaltaInboxNotification: false,
      operatorAttentionRequired: false,
      reason: 'external_channel_delivery',
    };
  }

  if (delivery.status === 'delivered') {
    return {
      createHomeLifecycleItem: false,
      createPaltaInboxNotification: true,
      operatorAttentionRequired: false,
      reason: 'palta_inbox_artifact_delivered',
    };
  }

  return {
    createHomeLifecycleItem: false,
    createPaltaInboxNotification: false,
    operatorAttentionRequired: false,
    reason: 'transport_state_not_lifecycle_state',
  };
}
