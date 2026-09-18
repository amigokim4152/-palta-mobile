export type NotificationImportance = 'normal' | 'important' | 'urgent';

export type NotificationInboxItem = {
  id: string;
  title: string;
  body?: string;
  sourceDomain: string;
  createdAt: string;
  importance: NotificationImportance;
  target: string;
  readAt?: string;
};

export type NotificationInboxSummary = {
  unreadCount: number;
  importantUnreadCount: number;
  urgentUnreadCount: number;
  latestUnreadAt?: string;
};

export function summarizeNotificationInbox(
  items: readonly NotificationInboxItem[],
): NotificationInboxSummary {
  const unread = items.filter((item) => !item.readAt);
  const summary: NotificationInboxSummary = {
    unreadCount: unread.length,
    importantUnreadCount: unread.filter((item) => item.importance === 'important').length,
    urgentUnreadCount: unread.filter((item) => item.importance === 'urgent').length,
  };

  const latestUnreadAt = unread
    .map((item) => item.createdAt)
    .filter((value) => !Number.isNaN(new Date(value).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  if (latestUnreadAt) summary.latestUnreadAt = latestUnreadAt;
  return summary;
}

export function markNotificationRead(
  item: NotificationInboxItem,
  readAt = new Date().toISOString(),
): NotificationInboxItem {
  if (item.readAt) return item;
  return { ...item, readAt };
}

export function validateNotificationInboxItem(
  item: NotificationInboxItem,
): string[] {
  const errors: string[] = [];
  if (!item.id.trim()) errors.push('notification.id is required');
  if (!item.title.trim()) errors.push('notification.title is required');
  if (!item.sourceDomain.trim()) errors.push('notification.sourceDomain is required');
  if (!item.target.trim()) errors.push('notification.target is required');
  if (Number.isNaN(new Date(item.createdAt).getTime())) {
    errors.push('notification.createdAt must be a valid timestamp');
  }
  return errors;
}
