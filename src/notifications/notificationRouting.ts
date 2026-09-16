import type { NotificationMessage } from '../ports/notificationPort.js';
import {
  parsePaltaDeepLink,
  toAppPath,
} from '../navigation/deepLink.js';

export type NotificationRouteResult =
  | { kind: 'internal'; path: string }
  | { kind: 'ignored'; reason: 'missing_target' | 'invalid_target' };

export function routeNotification(
  message: NotificationMessage,
): NotificationRouteResult {
  if (!message.target) {
    return { kind: 'ignored', reason: 'missing_target' };
  }

  const parsed = parsePaltaDeepLink(message.target);
  if (!parsed) {
    return { kind: 'ignored', reason: 'invalid_target' };
  }

  return {
    kind: 'internal',
    path: toAppPath(parsed),
  };
}
