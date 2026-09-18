import {
  assertPublicNewsProjectionSafe,
  type PublicNewsHome,
  type PublicNewsVoiceContribution,
  type PublicNewsVoicesPage,
} from '../src/news/publicContracts.js';
import {
  toNewsHomeViewModel,
  toNewsVoicesViewModel,
} from '../src/news/newsWebModel.js';
import { publicNewsPath } from '../src/news/publicNewsClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const brief = (id: string, section: 'essential' | 'nearby' | 'chile' | 'local' | 'deep_dive' | 'voices', publishedAt: string) => ({
  storyId: id,
  slug: `story-${id}`,
  section,
  title: `Título ${id}`,
  summary: `Resumen ${id}`,
  contentClass: section === 'deep_dive' ? 'deep_dive' as const : 'official_source' as const,
  publishedAt,
  geography: { countryCode: 'CL' as const, precision: 'country' as const },
  topic: 'general',
  source: { label: 'Fuente', attribution: 'Fuente de prueba.', sourceType: 'official' as const },
  actions: [],
});

const safeHome: PublicNewsHome = {
  schemaVersion: 1,
  locale: 'es-CL',
  generatedAt: '2026-09-18T07:00:00-03:00',
  publicationGate: 'closed',
  sections: {
    essential: [
      brief('old', 'essential', '2026-09-18T06:00:00-03:00'),
      brief('new', 'essential', '2026-09-18T08:00:00-03:00'),
      brief('mid', 'essential', '2026-09-18T07:00:00-03:00'),
      brief('overflow', 'essential', '2026-09-18T05:00:00-03:00'),
    ],
    nearby: [], chile: [], local: [], deep_dive: [], voices: [],
  },
};
assertPublicNewsProjectionSafe(safeHome);
assert(safeHome.publicationGate === 'closed', 'News Web mock/public contract must remain fail-closed during development.');
const homeView = toNewsHomeViewModel(safeHome);
assert(homeView.publicationGate === 'closed', 'View model must preserve the publication gate.');
assert(homeView.essential.length === 3, 'Lo esencial must remain intentionally capped at three items.');
assert(homeView.essential[0]?.storyId === 'new', 'News Home must order sections newest first.');
assert(homeView.isEmpty === false, 'A Home with one populated section is not empty.');

const voice: PublicNewsVoiceContribution = {
  storyId: 'voice-1', slug: 'voz-local-ejemplo', section: 'voices', title: 'Una voz local',
  summary: 'Una experiencia claramente etiquetada.', contentClass: 'local_voice',
  publishedAt: '2026-09-18T07:00:00-03:00',
  geography: { countryCode: 'CL', precision: 'comuna', comunaName: 'Vitacura' },
  topic: 'voces_locales',
  source: { label: 'Colaborador', attribution: 'Perspectiva del autor.', sourceType: 'contributor' },
  actions: [], voiceType: 'essay', contributorLabel: 'Autor de ejemplo',
  perspectiveDisclosure: 'No es un hecho noticioso verificado ni la posición de Palta.',
  mediaRights: 'none_required',
};
assertPublicNewsProjectionSafe(voice);

const voicesPayload: PublicNewsVoicesPage = {
  schemaVersion: 1, locale: 'es-CL', generatedAt: '2026-09-18T07:00:00-03:00',
  publicationGate: 'closed', disclosure: 'Las voces son perspectivas de sus autores.',
  contributions: [
    voice,
    { ...voice, storyId: 'voice-2', slug: 'entrevista-local', voiceType: 'interview', publishedAt: '2026-09-18T08:00:00-03:00' },
    { ...voice, storyId: 'voice-3', slug: 'arte-estudiantil', voiceType: 'student_art', mediaRights: 'cleared' },
  ],
};
const voicesView = toNewsVoicesViewModel(voicesPayload);
assert(voicesView.essays.length === 1, 'Essays must remain a separate Local Voices group.');
assert(voicesView.interviews.length === 1, 'Interviews must remain a separate Local Voices group.');
assert(voicesView.showcase.length === 1, 'Student art must route to Community Showcase, not factual News.');

assert(publicNewsPath({ kind: 'home' }) === '/v1/cl/news/home', 'Home must use the public News namespace.');
assert(publicNewsPath({ kind: 'comuna', slug: 'vitacura' }) === '/v1/cl/news/comunas/vitacura', 'Comuna routing must be deterministic.');
assert(publicNewsPath({ kind: 'story', slug: 'una-noticia-local' }) === '/v1/cl/news/stories/una-noticia-local', 'Story routing must be deterministic.');
let invalidRouteBlocked = false;
try {
  publicNewsPath({ kind: 'story', slug: '../editorial-inbox' });
} catch {
  invalidRouteBlocked = true;
}
assert(invalidRouteBlocked, 'News Web must reject paths that could escape the public API namespace.');

let blocked = false;
try {
  assertPublicNewsProjectionSafe({ storyId: 'unsafe-1', title: 'Unsafe projection', risk_flags: ['internal-only'] });
} catch (error) {
  blocked = error instanceof Error && error.message.includes('risk_flags');
}
assert(blocked, 'Public News projection must reject internal risk flags.');

blocked = false;
try {
  assertPublicNewsProjectionSafe({ story: { title: 'Nested unsafe projection', editorial_state: 'verification_required' } });
} catch (error) {
  blocked = error instanceof Error && error.message.includes('editorial_state');
}
assert(blocked, 'Public News projection must reject nested editorial workflow state.');

console.log('PASS: Palta News Web public projection + view model + public API route tests');
