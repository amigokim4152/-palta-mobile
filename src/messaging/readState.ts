import type { ParticipantState } from './contracts.js';

export function unreadCount(lastConversationSequence: number, participant: ParticipantState): number {
  return Math.max(0, lastConversationSequence - participant.lastReadSequence);
}

export function advanceDelivered(participant: ParticipantState, sequence: number): ParticipantState {
  if (sequence <= participant.lastDeliveredSequence) return participant;
  return { ...participant, lastDeliveredSequence: sequence };
}

export function advanceRead(participant: ParticipantState, sequence: number): ParticipantState {
  const nextRead = Math.max(participant.lastReadSequence, sequence);
  const nextDelivered = Math.max(participant.lastDeliveredSequence, nextRead);
  if (nextRead === participant.lastReadSequence && nextDelivered === participant.lastDeliveredSequence) return participant;
  return { ...participant, lastReadSequence: nextRead, lastDeliveredSequence: nextDelivered };
}

export function messageIdempotencyKey(conversationId: string, senderActorId: string, clientMessageId: string): string {
  return `${conversationId}:${senderActorId}:${clientMessageId}`;
}
