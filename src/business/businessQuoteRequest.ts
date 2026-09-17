export type BusinessQuoteRequestStatus =
  | 'draft'
  | 'collecting'
  | 'responses_ready'
  | 'selected'
  | 'completed'
  | 'cancelled';

export type BusinessQuoteResponseStatus =
  | 'submitted'
  | 'withdrawn'
  | 'selected'
  | 'declined';

export type BusinessQuoteRequest = Readonly<{
  id: string;
  requesterUserId: string;
  description: string;
  recipientBusinessIds: readonly string[];
  serviceTaxonomyIds: readonly string[];
  status: BusinessQuoteRequestStatus;
  createdAt: string;
  requestedFor?: string;
  serviceAreaId?: string;
  mediaRefs?: readonly string[];
  selectedBusinessId?: string;
}>;

export type BusinessQuoteResponse = Readonly<{
  id: string;
  quoteRequestId: string;
  businessId: string;
  status: BusinessQuoteResponseStatus;
  submittedAt: string;
  amountClp?: number;
  note?: string;
  availableAt?: string;
  validUntil?: string;
}>;

export type BusinessQuoteComparisonItem = Readonly<{
  responseId: string;
  businessId: string;
  amountClp?: number;
  note?: string;
  availableAt?: string;
  validUntil?: string;
  selected: boolean;
}>;

function validInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validateBusinessQuoteRequest(
  request: BusinessQuoteRequest,
): readonly string[] {
  const issues: string[] = [];
  if (!request.id.trim()) issues.push('quote_request_id_required');
  if (!request.requesterUserId.trim()) issues.push('requester_user_id_required');
  const description = request.description.trim();
  if (description.length < 10) issues.push('quote_description_too_short');
  if (description.length > 2000) issues.push('quote_description_too_long');
  if (!validInstant(request.createdAt)) issues.push('quote_created_at_invalid');
  if (request.requestedFor && !validInstant(request.requestedFor)) {
    issues.push('quote_requested_for_invalid');
  }
  const recipients = [...new Set(request.recipientBusinessIds.map((id) => id.trim()).filter(Boolean))];
  if (!recipients.length) issues.push('quote_recipient_required');
  if (recipients.length > 10) issues.push('quote_recipient_limit_exceeded');
  if (request.mediaRefs && request.mediaRefs.length > 6) issues.push('quote_media_limit_exceeded');
  if (request.mediaRefs?.some((ref) => !ref.trim())) issues.push('quote_media_ref_invalid');
  if (request.selectedBusinessId && !recipients.includes(request.selectedBusinessId)) {
    issues.push('selected_business_not_recipient');
  }
  return [...new Set(issues)];
}

export function validateBusinessQuoteResponse(
  response: BusinessQuoteResponse,
): readonly string[] {
  const issues: string[] = [];
  if (!response.id.trim()) issues.push('quote_response_id_required');
  if (!response.quoteRequestId.trim()) issues.push('quote_request_id_required');
  if (!response.businessId.trim()) issues.push('quote_business_id_required');
  if (!validInstant(response.submittedAt)) issues.push('quote_submitted_at_invalid');
  if (response.amountClp !== undefined && (!Number.isInteger(response.amountClp) || response.amountClp < 0)) {
    issues.push('quote_amount_invalid');
  }
  if (response.note && response.note.trim().length > 2000) issues.push('quote_note_too_long');
  if (response.availableAt && !validInstant(response.availableAt)) issues.push('quote_available_at_invalid');
  if (response.validUntil && !validInstant(response.validUntil)) issues.push('quote_valid_until_invalid');
  return [...new Set(issues)];
}

export function projectQuoteComparison(input: {
  request: BusinessQuoteRequest;
  responses: readonly BusinessQuoteResponse[];
  now: string | Date;
}): BusinessQuoteComparisonItem[] {
  const nowMs = input.now instanceof Date ? input.now.getTime() : Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('quote_comparison_now_invalid');
  const recipients = new Set(input.request.recipientBusinessIds);

  return input.responses
    .filter((response) => recipients.has(response.businessId))
    .filter((response) => response.status === 'submitted' || response.status === 'selected')
    .filter((response) => validateBusinessQuoteResponse(response).length === 0)
    .filter((response) => !response.validUntil || Date.parse(response.validUntil) > nowMs)
    .sort((a, b) => {
      const aAmount = a.amountClp ?? Number.POSITIVE_INFINITY;
      const bAmount = b.amountClp ?? Number.POSITIVE_INFINITY;
      if (aAmount !== bAmount) return aAmount - bAmount;
      return Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
    })
    .map((response) => ({
      responseId: response.id,
      businessId: response.businessId,
      ...(response.amountClp !== undefined ? { amountClp: response.amountClp } : {}),
      ...(response.note?.trim() ? { note: response.note.trim() } : {}),
      ...(response.availableAt ? { availableAt: response.availableAt } : {}),
      ...(response.validUntil ? { validUntil: response.validUntil } : {}),
      selected:
        response.status === 'selected' ||
        input.request.selectedBusinessId === response.businessId,
    }));
}

export function selectQuoteBusiness(
  request: BusinessQuoteRequest,
  businessId: string,
): BusinessQuoteRequest {
  if (validateBusinessQuoteRequest(request).length) throw new Error('invalid_quote_request');
  if (!request.recipientBusinessIds.includes(businessId)) {
    throw new Error('selected_business_not_recipient');
  }
  return {
    ...request,
    selectedBusinessId: businessId,
    status: 'selected',
  };
}
