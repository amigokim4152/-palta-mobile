export type QuoteRequestStatus =
  | 'draft'
  | 'open'
  | 'routing'
  | 'responses_available'
  | 'selected'
  | 'expired'
  | 'cancelled'
  | 'completed';

export type QuoteRequest = {
  id: string;
  userId: string;
  categoryId: string;
  locationScope: {
    kind: 'exact_private' | 'neighborhood' | 'commune';
    value: string;
  };
  description: string;
  attachmentRefs?: readonly string[];
  status: QuoteRequestStatus;
  maxProviders: number;
  createdAt: string;
  expiresAt?: string;
};

export type QuoteResponse = {
  id: string;
  requestId: string;
  providerId: string;
  amountMinor?: number;
  currency?: string;
  message?: string;
  estimatedStartAt?: string;
  estimatedDurationMinutes?: number;
  includedItems?: readonly string[];
  excludedItems?: readonly string[];
  status: 'submitted' | 'updated' | 'withdrawn' | 'selected' | 'rejected';
  createdAt: string;
  updatedAt: string;
};
