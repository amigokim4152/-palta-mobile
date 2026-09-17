import type { RealtimeEnvelope } from './contracts.js';

export interface RealtimeSubscription {
  close(): Promise<void> | void;
}

export interface RealtimeAdapter {
  publish(envelope: RealtimeEnvelope): Promise<void>;
  subscribe(conversationId: string, onEnvelope: (envelope: RealtimeEnvelope) => void): Promise<RealtimeSubscription>;
  publishTyping(conversationId: string, actorId: string, isTyping: boolean): Promise<void>;
  publishPresence(actorId: string, state: 'online' | 'offline' | 'away'): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
