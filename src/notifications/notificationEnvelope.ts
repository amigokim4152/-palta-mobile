export type NotificationCategory =
  | 'care_state'
  | 'deadline'
  | 'safety'
  | 'local_change'
  | 'content';

export type PaltaNotificationEnvelope = {
  id: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  target?: string;
  occurredAt: string;
  expiresAt?: string;
  collapseKey?: string;
};

export function isExpiredNotification(
  envelope: PaltaNotificationEnvelope,
  nowIso: string,
): boolean {
  if (!envelope.expiresAt) return false;
  return new Date(envelope.expiresAt).getTime() <= new Date(nowIso).getTime();
}
