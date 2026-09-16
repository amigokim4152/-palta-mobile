import type { DeliveryLevel, HomeCandidate } from '../core/contracts.js';

/**
 * Delivery is intentionally separate from Home composition.
 * Being useful enough for Home does not imply that a push notification is justified.
 */
export function resolveDelivery(candidate: HomeCandidate): DeliveryLevel {
  if (candidate.deliveryHint === 'urgent') return 'urgent';
  if (candidate.kind === 'alert' && candidate.urgency >= 4) return 'urgent';

  // Discovery/news/weather/info must not become engagement push by default.
  if (candidate.kind === 'content' || candidate.kind === 'info') return 'home';

  if (candidate.actionRequired && candidate.urgency >= 3) return 'home_notify';
  if (candidate.kind === 'status' && candidate.urgency >= 3) return 'home_notify';
  if (candidate.relevance < 0.25 && candidate.importance < 2) return 'ignore';
  return candidate.deliveryHint ?? 'home';
}
