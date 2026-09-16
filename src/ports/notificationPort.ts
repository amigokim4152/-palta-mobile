export type NotificationPermission =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'restricted';

export type NotificationMessage = {
  id: string;
  title: string;
  body?: string;
  target?: string;
  urgency?: 'normal' | 'high';
};

export interface NotificationPort {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  registerDevice(): Promise<{ deviceToken: string }>;
  openTarget(message: NotificationMessage): Promise<void> | void;
}
