import { PublicDataApiClient } from '../src/api/publicDataApiClient.js';
import type { FetchLike } from '../src/api/paltaApiClient.js';
import { publicDataHomeToFunctionalItems } from '../src/home/publicDataHomeBridge.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let requestedUrl = '';
let requestedHeaders: Record<string, string> | undefined;
const fetchMock: FetchLike = async (input, init) => {
  requestedUrl = input;
  requestedHeaders = init?.headers;
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        api_version: 'v1',
        projection_version: 'public-home-17',
        generated_at: '2026-09-18T20:00:00.000Z',
        comuna_code: '13132',
        items: [
          {
            record_id: 'benefit-vitacura-1',
            canonical_version: 3,
            record_type: 'benefit',
            title: 'Beneficio municipal vigente',
            summary: 'Postulación para residentes que cumplen los requisitos publicados.',
            category: 'social',
            jurisdiction: { scope: 'comuna', comuna_codes: ['13132'] },
            relevance_facts: { resident_required: true },
            validity: { deadline_at: '2026-09-20T20:00:00.000Z' },
            action_refs: ['apply-1'],
            resolved_action: {
              action_id: 'apply-1',
              action_type: 'apply',
              url: 'https://vitacura.cl/postular',
              requires_identity: true,
              last_checked_at: '2026-09-18T19:30:00.000Z',
            },
          },
          {
            record_id: 'service-national-1',
            canonical_version: 1,
            record_type: 'service',
            title: 'Servicio nacional',
            jurisdiction: { scope: 'national' },
            relevance_facts: { senior_only: true },
          },
          {
            record_id: 'event-panorama-1',
            canonical_version: 1,
            record_type: 'event',
            title: 'Evento cultural',
            jurisdiction: { scope: 'comuna', comuna_codes: ['13132'] },
          },
        ],
      };
    },
  };
};

const client = new PublicDataApiClient({
  baseUrl: 'https://public-api.somospalta.cl/',
  fetch: fetchMock,
});

const response = await client.getHome({
  comunaCode: '13132',
  category: 'social',
  limit: 20,
});

assert(
  requestedUrl ===
    'https://public-api.somospalta.cl/v1/cl/public/home?comuna_code=13132&category=social&limit=20',
  'Public Data Home client must call the canonical public endpoint with coarse query context only.',
);
assert(
  !requestedUrl.includes('age') &&
    !requestedUrl.includes('rsh') &&
    !requestedUrl.includes('profile'),
  'Public Data request must not send private eligibility/profile attributes.',
);
assert(requestedHeaders?.Accept === 'application/json', 'Public Data client must request JSON.');
assert(response.items.length === 3, 'Client should preserve validated public Home items.');

const now = new Date('2026-09-18T20:00:00.000Z');
const items = publicDataHomeToFunctionalItems({
  response,
  expectedComunaCode: '13132',
  now,
  isRelevant(record) {
    return record.relevance_facts?.resident_required === true;
  },
});

assert(items.length === 1, 'Private relevance matching and municipal record-type filtering must happen before Home admission.');
const benefit = items[0];
assert(benefit?.id === 'public-life-benefit-vitacura-1', 'Approved canonical record id must remain stable through the Home bridge.');
assert(benefit?.surface === 'now', 'A municipal deadline inside the attention window must escalate to AHORA.');
assert(benefit?.capabilityKey === 'now.admin_deadline', 'Imminent approved benefit must use the admin deadline capability.');
assert(benefit?.action?.target === 'https://vitacura.cl/postular', 'Only the resolved verified official action should become the Home action target.');
assert(benefit?.source.expiresAt === '2026-09-18T20:05:00.000Z', 'Public Data Home input should inherit the five-minute cache TTL.');
assert(validateHomeFunctionalItem(benefit!).length === 0, 'Public Data bridge output must satisfy the Home contract.');

const wrongComuna = publicDataHomeToFunctionalItems({
  response,
  expectedComunaCode: '13114',
  now,
  isRelevant: () => true,
});
assert(wrongComuna.length === 0, 'A response for a different comuna must fail closed instead of leaking local cards.');

console.log('PASS: approved Public Data API -> private relevance -> Municipal Home bridge');
