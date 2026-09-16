export type EvidenceLevel =
  | 'known_from_profile'
  | 'user_confirmed'
  | 'verified_external'
  | 'common_risk_prompt'
  | 'unknown';

export type Urgency =
  | 'immediate'
  | 'today'
  | 'soon'
  | 'later';

export type Actionability =
  | 'palta_can_do'
  | 'palta_can_connect'
  | 'user_must_confirm'
  | 'user_must_do'
  | 'inform_only';

export type LifeEventRisk = {
  id: string;
  title: string;
  rationale: string;
  evidence: EvidenceLevel;
  urgency: Urgency;
  actionability: Actionability;
  relatedDomains: readonly string[];
  confirmQuestion?: string;
  suggestedAction?: string;
};

export type LifeEventContext = {
  eventType: string;
  knownFacts: Record<string, boolean | string | number | undefined>;
  confirmedFacts: Record<string, boolean | string | number | undefined>;
};

export type LifeEventGuidance = {
  eventType: string;
  immediate: LifeEventRisk[];
  today: LifeEventRisk[];
  soon: LifeEventRisk[];
  later: LifeEventRisk[];
};
