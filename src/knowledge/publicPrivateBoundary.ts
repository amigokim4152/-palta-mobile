import type { KnowledgeEntity } from './contracts.js';

const forbiddenCanonicalKeys = new Set([
  'userId',
  'personId',
  'householdId',
  'childId',
  'petRecordId',
  'diagnosisId',
  'medicationId',
  'exactLocation',
  'readHistory',
  'snoozeHistory',
]);

export interface BoundaryViolation {
  path: string;
  key: string;
}

function scan(value: unknown, path: string, violations: BoundaryViolation[]): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, `${path}[${index}]`, violations));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenCanonicalKeys.has(key)) violations.push({ path: nextPath, key });
    scan(nested, nextPath, violations);
  }
}

export function validateCanonicalPublicBoundary(entity: KnowledgeEntity): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  scan(entity, '', violations);
  return violations;
}

export interface PrivateKnowledgeProjection {
  id: string;
  userId: string;
  knowledgeId: string;
  sourceVersion: number;
  locale: string;
  reasonRelevantNow?: string;
  generatedSummary?: string;
  createdAt: string;
}

export const PRIVATE_PROJECTION_IS_CANONICAL_KNOWLEDGE = false;
