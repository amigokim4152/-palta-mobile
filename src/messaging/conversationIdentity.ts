import type { ActorRef } from './contracts.js';

function actorSortKey(actor: Pick<ActorRef, 'actorType' | 'actorId'>): string {
  return `${actor.actorType}\u0000${actor.actorId}`;
}

export function canonicalConversationPair(
  first: ActorRef,
  second: ActorRef,
): [ActorRef, ActorRef] {
  if (
    first.actorType === second.actorType &&
    first.actorId === second.actorId
  ) {
    throw new Error('One-to-one conversation requires two different actors.');
  }
  return actorSortKey(first) <= actorSortKey(second)
    ? [first, second]
    : [second, first];
}

export function oneToOneConversationIdentityKey(
  first: Pick<ActorRef, 'actorType' | 'actorId'>,
  second: Pick<ActorRef, 'actorType' | 'actorId'>,
): string {
  const [a, b] = canonicalConversationPair(
    { actorType: first.actorType, actorId: first.actorId },
    { actorType: second.actorType, actorId: second.actorId },
  );
  return `${a.actorType}:${a.actorId}|${b.actorType}:${b.actorId}`;
}
