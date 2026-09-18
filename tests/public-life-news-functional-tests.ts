import {
  municipalRecordsToFunctionalHome,
  newsRecordsToFunctionalHome,
} from '../src/home/adapters/publicLifeNewsFunctionalAdapters.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T12:00:00.000Z');

const benefits = municipalRecordsToFunctionalHome(
  {
    dataMode: 'scheduled',
    observedAt: '2026-09-18T11:30:00.000Z',
    records: [
      {
        id: 'ongoing',
        title: 'Servicio municipal vigente',
        verification: 'verified',
        localityMatches: true,
        eligibilityRelevant: true,
        ongoing: true,
        sourceUrl: 'https://example.cl/ongoing',
      },
      {
        id: 'deadline',
        title: 'Postulación cierra pronto',
        verification: 'corroborated',
        localityMatches: true,
        eligibilityRelevant: true,
        deadlineAt: '2026-09-20T12:00:00.000Z',
      },
      {
        id: 'undated',
        title: 'Claim without dates',
        verification: 'verified',
        localityMatches: true,
        eligibilityRelevant: true,
      },
      {
        id: 'wrong-locality',
        title: 'Otra comuna',
        verification: 'verified',
        localityMatches: false,
        eligibilityRelevant: true,
        ongoing: true,
      },
      {
        id: 'unverified',
        title: 'Needs verification',
        verification: 'needs_verification',
        localityMatches: true,
        eligibilityRelevant: true,
        ongoing: true,
      },
    ],
  },
  now,
);
assert(benefits.length === 2, 'Only verified/corroborated, local, relevant and current municipal records should enter Home.');
assert(benefits.find((item) => item.id.endsWith('ongoing'))?.surface === 'useful_today', 'Ongoing benefit belongs in PARA HOY.');
assert(benefits.find((item) => item.id.endsWith('deadline'))?.surface === 'now', 'Benefit deadline within attention window belongs in AHORA.');
assert(benefits.every((item) => validateHomeFunctionalItem(item).length === 0), 'Municipal items must satisfy Home contract.');

const unavailableBenefits = municipalRecordsToFunctionalHome({
  dataMode: 'unavailable',
  observedAt: now.toISOString(),
  records: [
    {
      id: 'fake',
      title: 'Should not leak',
      verification: 'verified',
      localityMatches: true,
      eligibilityRelevant: true,
      ongoing: true,
    },
  ],
}, now);
assert(unavailableBenefits.length === 0, 'Unavailable public-life source must not be replaced by stored-looking values.');

const news = newsRecordsToFunctionalHome(
  {
    dataMode: 'cached',
    observedAt: '2026-09-18T11:30:00.000Z',
    maxAgeHours: 48,
    minimumRelevance: 0.6,
    records: [
      {
        id: 'a-old-duplicate',
        title: 'Cambio local importante',
        localityMatches: true,
        relevance: 0.8,
        publishedAt: '2026-09-18T08:00:00.000Z',
        sourceUrl: 'https://example.cl/news/1/',
      },
      {
        id: 'a-best',
        title: 'Cambio local importante actualizado',
        localityMatches: true,
        relevance: 0.9,
        publishedAt: '2026-09-18T10:00:00.000Z',
        sourceUrl: 'https://example.cl/news/1',
      },
      {
        id: 'b',
        title: 'Otra noticia útil',
        localityMatches: true,
        relevance: 0.7,
        publishedAt: '2026-09-18T11:00:00.000Z',
      },
      {
        id: 'stale',
        title: 'Noticia vieja',
        localityMatches: true,
        relevance: 1,
        publishedAt: '2026-09-14T11:00:00.000Z',
      },
      {
        id: 'weak',
        title: 'Poco relevante',
        localityMatches: true,
        relevance: 0.2,
        publishedAt: '2026-09-18T11:30:00.000Z',
      },
      {
        id: 'other-place',
        title: 'Otra comuna',
        localityMatches: false,
        relevance: 1,
        publishedAt: '2026-09-18T11:30:00.000Z',
      },
    ],
  },
  now,
);
assert(news.length === 2, 'News must filter stale/weak/non-local records and deduplicate the same source.');
assert(news[0]?.id === 'news-a-best', 'Duplicate news should keep the stronger/newer record.');
assert(news.every((item) => item.surface === 'useful_today' && item.kind === 'content'), 'Local news belongs in PARA HOY content.');
assert(news.every((item) => validateHomeFunctionalItem(item).length === 0), 'News items must satisfy Home contract.');

const unavailableNews = newsRecordsToFunctionalHome({
  dataMode: 'unavailable',
  observedAt: now.toISOString(),
  records: [
    {
      id: 'fake-news',
      title: 'Should not show',
      localityMatches: true,
      relevance: 1,
      publishedAt: now.toISOString(),
    },
  ],
}, now);
assert(unavailableNews.length === 0, 'Unavailable news source must not produce filler cards.');

console.log('PASS: Public-life and local-news -> Home functional projection tests');
