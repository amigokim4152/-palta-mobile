import type { PaltaApiClient, CareApiTrack } from '../api/paltaApiClient.js';
import {
  enqueueMutation,
  type OfflineMutation,
} from '../mobile/offlineMutationQueue.js';
import { toAppPath } from '../navigation/deepLink.js';

export type QuoteRequestSourceContext = 'business_detail';

export type QuoteRequestInput = {
  businessId: string;
  /** User-authored text. Preserve it in the language the user entered. */
  description?: string;
  photoRefs?: string[];
  /** Language-neutral machine context; never replace this with display copy. */
  sourceContext?: QuoteRequestSourceContext;
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

function carePayload(request: QuoteRequestInput): Record<string, unknown> {
  return {
    ...(request.description?.trim()
      ? { description: request.description }
      : {}),
    photo_refs: request.photoRefs ?? [],
    ...(request.sourceContext
      ? { source_context: request.sourceContext }
      : {}),
  };
}

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
    payload: carePayload(input.request),
    idempotencyKey: input.mutationId,
  });

  return {
    mode: 'online',
    care,
    nextPath: toAppPath({ kind: 'care', id: care.id }),
  };
}
