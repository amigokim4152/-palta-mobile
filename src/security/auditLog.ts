export type AuditActorType =
  | 'user'
  | 'business_user'
  | 'support'
  | 'operator'
  | 'service';

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorId: string;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: 'allowed' | 'denied' | 'failed';
  reason?: string;
  ipHash?: string;
  deviceIdHash?: string;
  correlationId?: string;
};

export interface AuditLogPort {
  append(event: AuditEvent): Promise<void>;
}
