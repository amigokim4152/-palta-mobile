export type HomeApiSurface =
  | 'now'
  | 'in_progress'
  | 'upcoming'
  | 'useful_today';

export type HomeApiDataMode =
  | 'live'
  | 'cached'
  | 'scheduled'
  | 'demo'
  | 'unavailable';

export type HomeApiCorrectionReason =
  | 'not_relevant'
  | 'wrong_subject'
  | 'already_done'
  | 'incorrect_information'
  | 'hide_type';

export type HomeApiSubject = {
  kind: 'person' | 'household' | 'vehicle' | 'pet' | 'business' | 'place' | 'other';
  id: string;
  label?: string;
};

/**
 * Backward-compatible Home item. Existing fields stay stable while the
 * function-first Home metadata is added as optional fields.
 */
export type HomeApiItem = {
  id: string;
  kind: 'action' | 'status' | 'alert' | 'useful_today' | 'content';
  title: string;
  body?: string;
  source_domain: string;
  delivery: 'home' | 'home_notify' | 'urgent';
  care_track_id?: string;
  related_entity_id?: string;
  surface?: HomeApiSurface;
  scheduled_at?: string;
  personalized?: boolean;
  subject?: HomeApiSubject;
  corrections?: HomeApiCorrectionReason[];
  action_label?: string;
  action_target?: string;
  action_kind?: 'internal' | 'external';
  data_mode?: HomeApiDataMode;
  observed_at?: string;
  expires_at?: string;
  dedupe_key?: string;
  urgency?: number;
  importance?: number;
  relevance?: number;
};

export type HomeApiGlanceItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  exceptional?: boolean;
  source_domain: string;
  data_mode: HomeApiDataMode;
  observed_at?: string;
  expires_at?: string;
  relevance?: number;
  action_label?: string;
  action_target?: string;
  action_kind?: 'internal' | 'external';
};

export type HomeApiContext = {
  locality: {
    id?: string;
    label: string;
    change_target: string;
  };
  notifications_target: string;
  unread_notification_count?: number;
  profile_target: string;
};

export type HomeApiResponse = {
  /** Allows clients/QA to distinguish the function-first extension. */
  contract_version?: 'functional-home-v1';
  generated_at?: string;
  /** Legacy convenience field retained during migration. */
  locality_label?: string;
  context?: HomeApiContext;
  glance?: HomeApiGlanceItem[];
  quiet_state?: {
    title: string;
    body?: string;
  };
  items: HomeApiItem[];
};
