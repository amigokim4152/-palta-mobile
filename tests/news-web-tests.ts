import {
  assertPublicNewsProjectionSafe,
  type PublicNewsHome,
  type PublicNewsVoiceContribution,
} from '../src/news/publicContracts.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const safeHome: PublicNewsHome = {
  schemaVersion: 1,
  locale: 'es-CL',
  generatedAt: '2026-09-18T07:00:00-03:00',
  publicationGate: 'closed',
  sections: {
    essential: [],
    nearby: [],
    chile: [],
    local: [],
    deep_dive: [],
    voices: [],
  },
};
assertPublicNewsProjectionSafe(safeHome);
assert(safeHome.publicationGate === 'closed', 'News Web mock/public contract must remain fail-closed during development.');

const voice: PublicNewsVoiceContribution = {
  storyId: 'voice-1',
  slug: 'voz-local-ejemplo',
  section: 'voices',
  title: 'Una voz local',
  summary: 'Una experiencia claramente etiquetada.',
  contentClass: 'local_voice',
  publishedAt: '2026-09-18T07:00:00-03:00',
  geography: { countryCode: 'CL', precision: 'comuna', comunaName: 'Vitacura' },
  topic: 'voces_locales',
  source: {
    label: 'Colaborador',
    attribution: 'Perspectiva del autor.',
    sourceType: 'contributor',
  },
  actions: [],
  voiceType: 'essay',
  contributorLabel: 'Autor de ejemplo',
  perspectiveDisclosure: 'No es un hecho noticioso verificado ni la posición de Palta.',
  mediaRights: 'none_required',
};
assertPublicNewsProjectionSafe(voice);

let blocked = false;
try {
  assertPublicNewsProjectionSafe({
    storyId: 'unsafe-1',
    title: 'Unsafe projection',
    risk_flags: ['internal-only'],
  });
} catch (error) {
  blocked = error instanceof Error && error.message.includes('risk_flags');
}
assert(blocked, 'Public News projection must reject internal risk flags.');

blocked = false;
try {
  assertPublicNewsProjectionSafe({
    story: {
      title: 'Nested unsafe projection',
      editorial_state: 'verification_required',
    },
  });
} catch (error) {
  blocked = error instanceof Error && error.message.includes('editorial_state');
}
assert(blocked, 'Public News projection must reject nested editorial workflow state.');

console.log('PASS: Palta News Web public projection boundary tests');
