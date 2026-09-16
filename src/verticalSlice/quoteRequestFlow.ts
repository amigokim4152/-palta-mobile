import type { PaltaApiClient, CareApiTrack } from '../api/paltaApiClient.js';
import {
  enqueueMutation,
  type OfflineMutation,
} from '../mobile/offlineMutationQueue.js';
import { toAppPath } from '../navigation/deepLink.js';

export type QuoteRequestInput = {
  businessId: string;
  description: string;
  photoRefs?: string[];
};

export type QuoteFlowResult =
  | {
      mode: 'online';
      care: CareApiTrack;
      nextPath: string;
    }
  | {
      mode: 'queued_offline';
      mutation: OfflineMutation<QuoteRequestInput>;
      nextPath: '/';
    };

export async function requestBusinessQuote(input: {
  online: boolean;
  api: PaltaApiClient;
  request: QuoteRequestInput;
  mutationId: string;
  now: string;
}): Promise<QuoteFlowResult> {
  if (!input.online) {
    return {
      mode: 'queued_offline',
      mutation: enqueueMutation({
        id: input.mutationId,
        kind: 'business_quote_request',
        payload: input.request,
        now: input.now,
      }),
      nextPath: '/',
    };
  }

  const care = await input.api.createCare({
    intentKey: 'local_business_quote',
    subjectEntityId: input.request.businessId,
    actionType: 'quote_request',
    payload: {
      description: input.request.description,
      photo_refs: input.request.photoRefs ?? [],
    },
    idempotencyKey: input.mutationId,
  });

  return {
    mode: 'online',
    care,
    nextPath: toAppPath({ kind: 'care', id: care.id }),
  };
}
