import type {
  ConversationScope,
  ConversationScopeResourceRef,
} from './contracts.js';

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function createConversationScope(input: ConversationScope): ConversationScope {
  required(input.scopeId, 'scopeId');
  required(input.conversationId, 'conversationId');
  required(input.scopeType, 'scopeType');
  if (input.state !== 'active') {
    throw new Error('A new conversation scope must start active.');
  }
  if (input.resolvedAt !== undefined || input.archivedAt !== undefined) {
    throw new Error('A new conversation scope cannot already be resolved or archived.');
  }
  return { ...input };
}

export function resolveConversationScope(scope: ConversationScope, resolvedAt: string): ConversationScope {
  if (scope.state === 'archived') throw new Error('Archived conversation scope cannot be resolved.');
  if (scope.state === 'resolved') return scope;
  return { ...scope, state: 'resolved', resolvedAt };
}

export function archiveConversationScope(scope: ConversationScope, archivedAt: string): ConversationScope {
  if (scope.state === 'archived') return scope;
  return { ...scope, state: 'archived', archivedAt };
}

export function scopeResourceKey(
  ref: Pick<ConversationScopeResourceRef, 'scopeId' | 'relation' | 'resourceType' | 'resourceId'>,
): string {
  return `${ref.scopeId}:${ref.relation}:${ref.resourceType}:${ref.resourceId}`;
}

export function addScopeResource(
  existing: ConversationScopeResourceRef[],
  next: ConversationScopeResourceRef,
): ConversationScopeResourceRef[] {
  required(next.scopeId, 'scopeId');
  required(next.resourceType, 'resourceType');
  required(next.resourceId, 'resourceId');
  const mismatchedScope = existing.find((item) => item.scopeId !== next.scopeId);
  if (mismatchedScope) throw new Error('Scope resource collection cannot mix different scopes.');
  const key = scopeResourceKey(next);
  if (existing.some((item) => scopeResourceKey(item) === key)) return existing;
  return [...existing, next];
}

export function primaryScopeResource(
  existing: ConversationScopeResourceRef[],
): ConversationScopeResourceRef | undefined {
  return existing.find((item) => item.relation === 'primary');
}
