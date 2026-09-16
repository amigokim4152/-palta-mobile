export type Domain =
  | 'home'
  | 'local'
  | 'community'
  | 'market'
  | 'play'
  | 'mobility'
  | 'health'
  | 'school'
  | 'vehicle'
  | 'pets'
  | 'public-life'
  | 'news'
  | 'weather'
  | 'other';

export type CandidateKind = 'action' | 'status' | 'alert' | 'info' | 'content';
export type DeliveryLevel = 'ignore' | 'home' | 'home_notify' | 'urgent';
export type Confidence = 'confirmed' | 'corroborated' | 'inferred' | 'unknown';
export type Freshness = 'current' | 'stale' | 'unknown';

export interface LocationRef {
  id: string;
  label: string;
  comuna?: string;
  lat?: number;
  lng?: number;
}

export interface LocationContext {
  currentLocation?: LocationRef;
  homeArea?: LocationRef;
  workArea?: LocationRef;
  savedPlaces: LocationRef[];
  exploringLocation?: LocationRef;
}

export interface UserClaim {
  key: string;
  value: string | number | boolean;
  confidence: Confidence;
  updatedAt: string;
}

export interface UserContext {
  userId: string;
  locale: 'es-CL' | 'ko' | string;
  locations: LocationContext;
  claims: UserClaim[];
  interests: string[];
}

export interface HomeAction {
  label: string;
  target: string;
  kind: 'internal' | 'deeplink' | 'external';
}

export interface HomeCandidate {
  id: string;
  domain: Domain;
  kind: CandidateKind;
  title: string;
  summary?: string;
  subjectRef?: string;
  sourceRef?: string;
  occurredAt?: string;
  validFrom?: string;
  validUntil?: string;
  urgency: 0 | 1 | 2 | 3 | 4;
  importance: 0 | 1 | 2 | 3 | 4;
  relevance: number;
  actionRequired: boolean;
  waitingState: boolean;
  confidence: Confidence;
  freshness: Freshness;
  dedupeKey: string;
  clusterKey?: string;
  deliveryHint?: DeliveryLevel;
  action?: HomeAction;
}

export interface HomeCard extends HomeCandidate {
  score: number;
  delivery: DeliveryLevel;
  relatedCandidateIds: string[];
}

export interface HomeComposition {
  primary: HomeCard[];
  secondary: HomeCard[];
  all: HomeCard[];
  generatedAt: string;
}
