export type ActorType = 'user' | 'business' | 'organization' | 'community' | 'support';
export type ConversationType = 'direct' | 'business' | 'transaction' | 'group' | 'support';
export type MessageType = 'text' | 'voice' | 'image' | 'file' | 'location' | 'resource_card' | 'action_card';
export type ParticipantRole = 'member' | 'customer' | 'owner' | 'manager' | 'staff' | 'moderator' | 'support';
export type DeliveryState = 'persisted' | 'queued' | 'delivered' | 'read';
export type AttachmentKind = 'image' | 'voice' | 'file';
export type ContextRelation = 'primary' | 'subject' | 'vehicle' | 'business' | 'listing' | 'job' | 'property' | 'quote' | 'booking' | 'order' | 'service_request' | 'other';
export type AIArtifactType = 'transcript' | 'translation' | 'summary' | 'intent' | 'entities' | 'suggested_action' | 'moderation';

export interface ActorRef {
  actorId: string;
  actorType: ActorType;
  /** Real signed-in principal for audit. May differ from actorId when a staff user acts as a business. */
  principalUserId?: string;
}

export interface Conversation {
  conversationId: string;
  type: ConversationType;
  createdAt: string;
  lastSequence: number;
  lastActivityAt: string;
}

export interface ParticipantState {
  conversationId: string;
  actor: ActorRef;
  role: ParticipantRole;
  joinedAt: string;
  leftAt?: string;
  lastDeliveredSequence: number;
  lastReadSequence: number;
  muted: boolean;
  archived: boolean;
}

export interface ResourceRef {
  resourceType: string;
  resourceId: string;
}

export interface ConversationContextRef extends ResourceRef {
  conversationId: string;
  relation: ContextRelation;
  /** Optional immutable display snapshot version; the domain object remains canonical. */
  snapshotVersion?: string;
}

export interface MessageAttachment {
  attachmentId: string;
  messageId: string;
  mediaId: string;
  kind: AttachmentKind;
  mimeType: string;
  sizeBytes?: number;
  durationMs?: number;
}

export interface ActionReference extends ResourceRef {
  action: string;
  /** Stable action contract version owned by the target domain, not by Message Core. */
  contractVersion: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  /** Client-generated idempotency token. Unique per sender within a conversation. */
  clientMessageId: string;
  sender: ActorRef;
  sequence: number;
  type: MessageType;
  body?: string;
  replyToMessageId?: string;
  actionRef?: ActionReference;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface DomainEventReference extends ResourceRef {
  eventId: string;
  eventType: string;
  occurredAt: string;
}

export interface AIArtifactReference {
  artifactId: string;
  messageId: string;
  type: AIArtifactType;
  provider?: string;
  model?: string;
  version: string;
  createdAt: string;
}

export interface OutboxEvent {
  outboxEventId: string;
  aggregateType: 'conversation' | 'message';
  aggregateId: string;
  eventType: string;
  createdAt: string;
  publishedAt?: string;
}

export type TimelineItem =
  | { kind: 'message'; sequence: number; message: Message }
  | { kind: 'domain_event'; sequence: number; event: DomainEventReference };

export interface RealtimeEnvelope {
  conversationId: string;
  sequence: number;
  kind: 'message_created' | 'message_updated' | 'read_advanced' | 'domain_event';
  refId: string;
  occurredAt: string;
}
