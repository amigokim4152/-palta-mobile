export type AttributionEventName =
  | 'impression'
  | 'card_view'
  | 'event_view'
  | 'venue_view'
  | 'offering_view'
  | 'save'
  | 'share'
  | 'map_open'
  | 'route_open'
  | 'ticket_click'
  | 'booking_click'
  | 'booking_start'
  | 'booking_complete'
  | 'purchase_confirmed'
  | 'check_in'
  | 'repeat_visit';

export type AttributionSubject = Readonly<{
  /** Privacy-safe session identifier; must not encode personal information. */
  paltaSessionId: string;
  /** Internal user reference or privacy-safe anonymous identifier. */
  actorRef?: string;
}>;

export type AttributionEvent = Readonly<{
  attributionId: string;
  eventName: AttributionEventName;
  occurredAt: string;
  subject: AttributionSubject;
  eventId?: string;
  venueId?: string;
  offeringId?: string;
  organizerId?: string;
  canonicalBusinessId?: string;
  partnerId?: string;
  commercialDealId?: string;
  campaignId?: string;
  transactionReference?: string;
  purchaseValueMinor?: number;
  currency?: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}>;

export function validateAttributionEvent(event: AttributionEvent): readonly string[] {
  const issues: string[] = [];
  if (!event.attributionId.trim()) issues.push('attribution_id_required');
  if (!event.occurredAt.trim()) issues.push('occurred_at_required');
  if (!event.subject.paltaSessionId.trim()) issues.push('session_id_required');
  if (event.purchaseValueMinor !== undefined && (!Number.isInteger(event.purchaseValueMinor) || event.purchaseValueMinor < 0)) {
    issues.push('purchase_value_invalid');
  }
  if (event.purchaseValueMinor !== undefined && !event.currency?.trim()) issues.push('purchase_currency_required');
  if (event.eventName === 'purchase_confirmed' && event.purchaseValueMinor === undefined) {
    issues.push('purchase_value_required');
  }
  return [...new Set(issues)];
}

/**
 * Attribution is deliberately a separate stream from personalization/profile
 * storage. Consumers should aggregate this by entity/deal/campaign without
 * exposing user profile facts to commercial partners.
 */
export type AttributionAggregate = Readonly<{
  entityRef: string;
  from: string;
  to: string;
  impressions: number;
  detailViews: number;
  outboundClicks: number;
  completedBookings: number;
  confirmedPurchases: number;
  confirmedRevenueMinor?: number;
  currency?: string;
}>;
