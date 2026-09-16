export type OutletKind =
  | 'permanent'
  | 'temporary'
  | 'mobile';

export type TradingSessionStatus =
  | 'scheduled'
  | 'open'
  | 'paused'
  | 'closed'
  | 'cancelled';

export type Outlet = {
  id: string;
  businessId: string;
  kind: OutletKind;
  name?: string;
};

export type TradingSession = {
  id: string;
  outletId: string;
  businessId: string;
  eventId?: string;
  status: TradingSessionStatus;
  startsAt: string;
  endsAt?: string;
  location: {
    lat: number;
    lng: number;
    label?: string;
  };
  ordering: {
    enabled: boolean;
    entryMode: 'qr_session' | 'open' | 'reservation_only';
    preOrderAllowed: boolean;
  };
};

export type CommerceOrderStatus =
  | 'created'
  | 'awaiting_payment'
  | 'paid'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'closed'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type CommerceOrder = {
  id: string;
  businessId: string;
  outletId: string;
  tradingSessionId: string;
  customerId?: string;
  status: CommerceOrderStatus;
  totalAmountMinor: number;
  currency: string;
  paymentIntentId?: string;
  pickupCode?: string;
  createdAt: string;
  updatedAt: string;
};
