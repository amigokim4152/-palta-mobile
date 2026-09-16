export type RetentionClass =
  | 'ephemeral'
  | 'operational'
  | 'transactional'
  | 'audit'
  | 'user_controlled';

export type RetentionPolicy = {
  class: RetentionClass;
  defaultDays: number | null;
  deletionMode: 'automatic' | 'policy_review' | 'user_controlled';
};

export function defaultRetention(
  retentionClass: RetentionClass,
): RetentionPolicy {
  switch (retentionClass) {
    case 'ephemeral':
      return { class: retentionClass, defaultDays: 7, deletionMode: 'automatic' };
    case 'operational':
      return { class: retentionClass, defaultDays: 90, deletionMode: 'automatic' };
    case 'transactional':
      return { class: retentionClass, defaultDays: null, deletionMode: 'policy_review' };
    case 'audit':
      return { class: retentionClass, defaultDays: null, deletionMode: 'policy_review' };
    case 'user_controlled':
      return { class: retentionClass, defaultDays: null, deletionMode: 'user_controlled' };
  }
}
