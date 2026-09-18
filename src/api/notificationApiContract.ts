import type {
  NotificationImportance,
  NotificationInboxItem,
  NotificationInboxSummary,
} from '../notification/inboxModel.js';

export type NotificationApiItem = {
  id: string;
  title: string;
  body?: string;
  source_domain: string;
  created_at: string;
  importance: NotificationImportance;
  target: string;
  read_at?: string;
};

export type NotificationApiSummary = {
  unread_count: number;
  important_unread_count: number;
  urgent_unread_count: number;
  latest_unread_at?: string;
};

export type NotificationApiResponse = {
  items: NotificationApiItem[];
  summary: NotificationApiSummary;
};

export function notificationInboxItemToApi(
  item: NotificationInboxItem,
): NotificationApiItem {
  return {
    id: item.id,
    title: item.title,
    source_domain: item.sourceDomain,
    created_at: item.createdAt,
    importance: item.importance,
    target: item.target,
    ...(item.body ? { body: item.body } : {}),
    ...(item.readAt ? { read_at: item.readAt } : {}),
  };
}

export function notificationSummaryToApi(
  summary: NotificationInboxSummary,
): NotificationApiSummary {
  return {
    unread_count: summary.unreadCount,
    important_unread_count: summary.importantUnreadCount,
    urgent_unread_count: summary.urgentUnreadCount,
    ...(summary.latestUnreadAt ? { latest_unread_at: summary.latestUnreadAt } : {}),
  };
}
