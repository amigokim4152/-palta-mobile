import { PaltaApiClient } from '../src/api/paltaApiClient.js';
import {
  businessCapabilityLabel,
  careIntentLabel,
  careWaitingForLabel,
  neighborhoodT,
} from '../src/localization/index.js';
import { requestBusinessQuote } from '../src/verticalSlice/quoteRequestFlow.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requests: Array<{ url: string; body?: string }> = [];
const api = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async (url, init) => {
    requests.push({
      url,
      ...(init?.body ? { body: init.body } : {}),
    });
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          id: 'care-test-1',
          intent_key: 'local_business_quote',
          state: 'wait',
          waiting_for: 'business_response',
        };
      },
    };
  },
});

await requestBusinessQuote({
  online: true,
  api,
  request: {
    businessId: 'biz-1',
    sourceContext: 'business_detail',
  },
  mutationId: 'mut-machine-context',
  now: '2026-09-18T12:00:00.000Z',
});

const machineRequest = JSON.parse(requests[0]?.body ?? '{}') as {
  payload?: Record<string, unknown>;
};
assert(
  machineRequest.payload?.source_context === 'business_detail',
  'Business-detail quote must use a stable machine source_context.',
);
assert(
  !('description' in (machineRequest.payload ?? {})),
  'Palta must not fabricate a human-language description for a machine-generated quote action.',
);
assert(
  !(requests[0]?.body ?? '').includes('Solicitud iniciada'),
  'Spanish UI/system prose must not leak into the canonical quote payload.',
);

await requestBusinessQuote({
  online: true,
  api,
  request: {
    businessId: 'biz-1',
    description: '브레이크를 밟으면 소리가 납니다',
  },
  mutationId: 'mut-user-description',
  now: '2026-09-18T12:01:00.000Z',
});

const userRequest = JSON.parse(requests[1]?.body ?? '{}') as {
  payload?: Record<string, unknown>;
};
assert(
  userRequest.payload?.description === '브레이크를 밟으면 소리가 납니다',
  'User-authored quote text must be preserved exactly in the language the user entered.',
);

const offline = await requestBusinessQuote({
  online: false,
  api,
  request: {
    businessId: 'biz-1',
    sourceContext: 'business_detail',
  },
  mutationId: 'mut-offline-machine-context',
  now: '2026-09-18T12:02:00.000Z',
});
assert(
  offline.mode === 'queued_offline' &&
    offline.mutation.payload.sourceContext === 'business_detail' &&
    !('description' in offline.mutation.payload),
  'Offline quote intent must preserve language-neutral system context without inventing display prose.',
);

assert(
  careIntentLabel('local_business_quote', 'ko') === '동네업체 견적 요청',
  'Care intent key must resolve to a Korean display label.',
);
assert(
  careWaitingForLabel('business_response', 'zh-Hans') === '商家回复',
  'Care waiting key must resolve to a Simplified Chinese display label.',
);
assert(
  careIntentLabel('future_unknown_intent', 'ko') === 'future_unknown_intent',
  'Unknown Care keys must remain stable instead of disappearing.',
);
assert(
  businessCapabilityLabel('queue', 'ko') === '대기 등록' &&
    businessCapabilityLabel('inquiry', 'zh-Hans') === '咨询',
  'Business capability keys must have locale-aware presentation labels.',
);
assert(
  neighborhoodT('neighborhood.a11y.mapResults', 'ko') === '지도 검색 결과' &&
    neighborhoodT('neighborhood.a11y.showMoreMap', 'zh-Hans') === '显示更多地图',
  'Neighborhood accessibility copy must follow the active locale.',
);

console.log('PASS: localization canonical boundary tests');
