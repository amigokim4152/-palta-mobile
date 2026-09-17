import type { ConversationContextRef } from './contracts.js';

export function contextKey(ref: Pick<ConversationContextRef, 'relation' | 'resourceType' | 'resourceId'>): string {
  return `${ref.relation}:${ref.resourceType}:${ref.resourceId}`;
}

export function addContextRef(existing: ConversationContextRef[], next: ConversationContextRef): ConversationContextRef[] {
  const key = contextKey(next);
  if (existing.some((item) => contextKey(item) === key)) return existing;
  return [...existing, next];
}

export function primaryContext(existing: ConversationContextRef[]): ConversationContextRef | undefined {
  return existing.find((item) => item.relation === 'primary');
}
