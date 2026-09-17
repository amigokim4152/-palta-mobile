import type { ActionReference, ActorRef } from './contracts.js';

export interface DomainActionRequest {
  requestId: string;
  conversationId: string;
  sourceMessageId: string;
  requestedBy: ActorRef;
  target: ActionReference;
  requestedAt: string;
}

export function buildDomainActionRequest(input: {
  requestId: string;
  conversationId: string;
  sourceMessageId: string;
  requestedBy: ActorRef;
  actionRef: ActionReference;
  requestedAt: string;
}): DomainActionRequest {
  return {
    requestId: input.requestId,
    conversationId: input.conversationId,
    sourceMessageId: input.sourceMessageId,
    requestedBy: input.requestedBy,
    target: input.actionRef,
    requestedAt: input.requestedAt,
  };
}
