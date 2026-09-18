import {
  CHILE_1_6_BASIC_CURRENT,
  CHILE_FIRST_GRADE_OBJECTIVE_SEEDS,
  CHILE_FIRST_GRADE_SUBJECTS,
} from '../src/education/curriculumRegistry.js';
import { learningNeedsPrivateStorage } from '../src/education/learningGraph.js';
import type { KnowledgeEntity, KnowledgeDomainProfile } from '../src/knowledge/contracts.js';
import { assessDomainGraduation } from '../src/knowledge/domainMaturity.js';
import { canonicalKnowledgeChangedEvent } from '../src/knowledge/events.js';
import { knowledgeToHomeCandidate } from '../src/knowledge/homeProjection.js';
import { validateCanonicalPublicBoundary } from '../src/knowledge/publicPrivateBoundary.js';
import { revisionConflict } from '../src/knowledge/revision.js';
import { routeKnowledgeContent } from '../src/knowledge/scopeBoundary.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(CHILE_1_6_BASIC_CURRENT.status === 'current', 'Chile 1°-6° Básico baseline must be marked current.');
assert(CHILE_1_6_BASIC_CURRENT.legalRefs.includes('Decreto 433/2012'), 'Current Chile baseline must preserve legal provenance.');
assert(CHILE_FIRST_GRADE_SUBJECTS.some((subject) => subject.id === 'CL-1B-music'), 'Music must remain part of first-grade curriculum seed.');
assert(CHILE_FIRST_GRADE_OBJECTIVE_SEEDS.every((oa) => oa.officialTextStored === false), 'Registry must link official OA without copying full official text by default.');

const entity: KnowledgeEntity = {
  id: 'KNOW-MATH-COUNTING-001',
  domain: 'education',
  kind: 'concept',
  version: 3,
  title: 'Counting',
  summary: 'A durable counting concept shared across curriculum and Palta knowledge.',
  sections: [{ key: 'core', body: 'Counting connects quantities with ordered number words and symbols.' }],
  relations: [],
  evidenceRefs: ['EVIDENCE-1'],
  locales: [{ locale: 'es-CL', sourceVersion: 3, state: 'current' }],
  countryScopes: ['GLOBAL'],
  tags: ['math', 'counting'],
  riskTier: 'low',
  publicationState: 'published',
  updatedAt: '2026-09-18T07:50:00Z',
};

const home = knowledgeToHomeCandidate({
  entity,
  locale: 'es-CL',
  relevance: 0.82,
  reasonRelevantNow: 'Connected to the learner curriculum context.',
  publicTarget: '/knowledge/KNOW-MATH-COUNTING-001',
});
assert(home.domain === 'education', 'Knowledge must project into the Palta education Home domain.');
assert(home.subjectRef === entity.id && home.sourceRef === `${entity.id}@v3`, 'Home projection must preserve canonical identity/version.');
assert(home.deliveryHint === 'home', 'Knowledge must not become engagement push by default.');

const conflict = revisionConflict(entity, { entityId: entity.id, baseVersion: 2 });
assert(conflict?.code === 'BASE_VERSION_MISMATCH', 'Stale AI revision must conflict instead of overwriting current knowledge.');
assert(revisionConflict(entity, { entityId: entity.id, baseVersion: 3 }) === undefined, 'Current base version should be eligible for revision validation.');

const unsafe = { ...entity, userId: 'private-user' } as unknown as KnowledgeEntity;
assert(validateCanonicalPublicBoundary(unsafe).some((item) => item.key === 'userId'), 'Canonical public knowledge must reject private user identifiers.');

assert(learningNeedsPrivateStorage({
  learnerId: 'learner-1',
  nodeId: 'NODE-1',
  state: 'learning',
  updatedAt: '2026-09-18T07:50:00Z',
}), 'Learner progress must always use private storage.');

assert(routeKnowledgeContent('durable_knowledge').storageLane === 'canonical_git', 'Durable knowledge must use canonical Git storage.');
assert(routeKnowledgeContent('public_benefit').storageLane === 'public_data_event_core', 'Municipal/public benefits must stay outside canonical knowledge.');
assert(routeKnowledgeContent('public_event').storageLane === 'public_data_event_core', 'Cultural schedules must stay in Public Data/Event Core.');
assert(routeKnowledgeContent('dynamic_observation').storageLane === 'dynamic_read_model', 'Current prices/availability observations must remain dynamic.');
assert(routeKnowledgeContent('news').storageLane === 'news_system', 'News must remain a separate Palta system.');
assert(routeKnowledgeContent('private_context').storageLane === 'private_store', 'Private context must remain isolated from public canonical knowledge.');

const profile: KnowledgeDomainProfile = {
  domain: 'music',
  maturity: 'mature',
  canonicalEntityCount: 1000,
  deepGuideCount: 100,
  relationCount: 5000,
  supportedLocales: ['es-CL', 'ko'],
  updatedAt: '2026-09-18T07:50:00Z',
};
const graduation = assessDomainGraduation(profile, {
  hasIndependentQuestionSpace: true,
  hasDeepContent: true,
  hasConnectedKnowledgeGraph: true,
  hasDistinctNavigationNeed: true,
  hasIndependentSearchValue: true,
  hasLocalizationValue: true,
  hasSustainableReviewFlow: true,
});
assert(graduation.candidate === 'standalone' && graduation.requiresHumanDecision, 'Standalone graduation must remain an explicit human decision.');

const event = canonicalKnowledgeChangedEvent({
  knowledgeId: entity.id,
  domain: entity.domain,
  version: entity.version,
  previousVersion: 2,
  revisionType: 'update',
  publicationState: 'published',
}, '2026-09-18T07:50:00Z');
assert(event.type === 'canonical.changed' && event.subjectRef === entity.id, 'Published knowledge must reuse the shared Palta canonical.changed event.');

console.log('knowledge-platform contract tests passed');
