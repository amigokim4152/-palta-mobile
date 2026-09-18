export type HomeSurface =
  | 'glance'
  | 'now'
  | 'in_progress'
  | 'upcoming'
  | 'useful_today';

export type HomeDataMode =
  | 'live'
  | 'cached'
  | 'scheduled'
  | 'demo'
  | 'unavailable';

export type HomeCorrectionReason =
  | 'not_relevant'
  | 'wrong_subject'
  | 'already_done'
  | 'incorrect_information'
  | 'hide_type';

export type HomeAction = {
  label: string;
  kind: 'internal' | 'external';
  target: string;
};

export type HomeSourceMeta = {
  domain: string;
  mode: HomeDataMode;
  observedAt?: string;
  expiresAt?: string;
};

export type HomeSubjectRef = {
  kind: 'person' | 'household' | 'vehicle' | 'pet' | 'business' | 'place' | 'other';
  id: string;
  label?: string;
};

export type HomeFunctionalItem = {
  id: string;
  surface: Exclude<HomeSurface, 'glance'>;
  kind: 'action' | 'status' | 'alert' | 'useful' | 'content';
  title: string;
  body?: string;
  scheduledAt?: string;
  personalized?: boolean;
  subject?: HomeSubjectRef;
  action?: HomeAction;
  corrections?: HomeCorrectionReason[];
  source: HomeSourceMeta;
  /** Same real-world event from multiple sources should share this key. */
  dedupeKey?: string;
  /** 0-4. Higher means it needs attention sooner. */
  urgency?: number;
  /** 0-4. Higher means the consequence matters more. */
  importance?: number;
  /** 0-1. Personal/context relevance, not engagement likelihood. */
  relevance?: number;
};

export type HomeGlanceSignal = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  exceptional?: boolean;
  action?: HomeAction;
  source: HomeSourceMeta;
  relevance?: number;
};

export type HomeContext = {
  locality: {
    id?: string;
    label: string;
    changeTarget: string;
  };
  notificationsTarget: string;
  unreadNotificationCount?: number;
  profileTarget: string;
};

export type HomeFunctionalPayload = {
  generatedAt: string;
  context: HomeContext;
  glance: HomeGlanceSignal[];
  now: HomeFunctionalItem[];
  inProgress: HomeFunctionalItem[];
  upcoming: HomeFunctionalItem[];
  usefulToday: HomeFunctionalItem[];
  quietState?: {
    title: string;
    body?: string;
  };
};

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRange(
  errors: string[],
  label: string,
  value: number | undefined,
  min: number,
  max: number,
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < min || value > max) {
    errors.push(`${label} must be between ${min} and ${max}`);
  }
}

export function validateHomeFunctionalItem(item: HomeFunctionalItem): string[] {
  const errors: string[] = [];

  if (!isNonEmpty(item.id)) errors.push('item.id is required');
  if (!isNonEmpty(item.title)) errors.push('item.title is required');
  if (!isNonEmpty(item.source.domain)) errors.push('item.source.domain is required');
  if (item.dedupeKey !== undefined && !isNonEmpty(item.dedupeKey)) {
    errors.push('item.dedupeKey must be non-empty when present');
  }

  validateRange(errors, 'item.urgency', item.urgency, 0, 4);
  validateRange(errors, 'item.importance', item.importance, 0, 4);
  validateRange(errors, 'item.relevance', item.relevance, 0, 1);

  if (item.source.mode === 'unavailable') {
    errors.push('unavailable source items must not be admitted to Home');
  }

  if (item.surface === 'upcoming' && !isNonEmpty(item.scheduledAt)) {
    errors.push('upcoming items require scheduledAt');
  }

  if (item.kind === 'action' && !item.action) {
    errors.push('action items require an executable action target');
  }

  if (item.action) {
    if (!isNonEmpty(item.action.label)) errors.push('action.label is required');
    if (!isNonEmpty(item.action.target)) errors.push('action.target is required');
  }

  if (item.personalized && (!item.corrections || item.corrections.length === 0)) {
    errors.push('personalized items require at least one correction path');
  }

  if (item.subject && !isNonEmpty(item.subject.id)) {
    errors.push('subject.id is required when subject is present');
  }

  return errors;
}

export function canRenderHomeFunctionalItem(
  item: HomeFunctionalItem,
  now = new Date(),
): boolean {
  if (validateHomeFunctionalItem(item).length > 0) return false;
  if (!item.source.expiresAt) return true;

  const expiresAt = new Date(item.source.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() >= now.getTime();
}

export function validateHomeFunctionalPayload(payload: HomeFunctionalPayload): string[] {
  const errors: string[] = [];

  if (!isNonEmpty(payload.generatedAt)) errors.push('payload.generatedAt is required');
  if (!isNonEmpty(payload.context.locality.label)) errors.push('context.locality.label is required');
  if (!isNonEmpty(payload.context.locality.changeTarget)) errors.push('context.locality.changeTarget is required');
  if (!isNonEmpty(payload.context.notificationsTarget)) errors.push('context.notificationsTarget is required');
  if (!isNonEmpty(payload.context.profileTarget)) errors.push('context.profileTarget is required');

  const sections: Array<[string, HomeFunctionalItem[]]> = [
    ['now', payload.now],
    ['in_progress', payload.inProgress],
    ['upcoming', payload.upcoming],
    ['useful_today', payload.usefulToday],
  ];

  for (const [section, items] of sections) {
    for (const item of items) {
      if (item.surface !== section) {
        errors.push(`${item.id}: surface ${item.surface} does not match ${section}`);
      }
      for (const error of validateHomeFunctionalItem(item)) {
        errors.push(`${item.id}: ${error}`);
      }
    }
  }

  for (const signal of payload.glance) {
    if (!isNonEmpty(signal.id)) errors.push('glance.id is required');
    if (!isNonEmpty(signal.label)) errors.push(`${signal.id}: glance.label is required`);
    if (!isNonEmpty(signal.value)) errors.push(`${signal.id}: glance.value is required`);
    if (!isNonEmpty(signal.source.domain)) errors.push(`${signal.id}: glance.source.domain is required`);
    validateRange(errors, `${signal.id}: glance.relevance`, signal.relevance, 0, 1);
    if (signal.source.mode === 'unavailable') {
      errors.push(`${signal.id}: unavailable glance signals must not be admitted to Home`);
    }
  }

  return errors;
}
