export type PublicDataRecordType =
  | 'benefit'
  | 'service'
  | 'procedure'
  | 'event'
  | 'notice'
  | 'facility'
  | 'program';

export type PublicDataJurisdictionScope =
  | 'national'
  | 'region'
  | 'province'
  | 'comuna'
  | 'multi_comuna'
  | 'location';

export type PublicDataJurisdiction = {
  scope: PublicDataJurisdictionScope;
  region_code?: string | null;
  provincia_code?: string | null;
  comuna_codes?: string[];
};

export type PublicDataValidity = {
  starts_at?: string | null;
  ends_at?: string | null;
  deadline_at?: string | null;
  current_status?: string | null;
};

export type PublicDataResolvedAction = {
  action_id: string;
  action_type:
    | 'apply'
    | 'reserve'
    | 'register'
    | 'pay'
    | 'report'
    | 'contact'
    | 'status_check'
    | 'ticket'
    | 'information';
  url: string;
  requires_identity?: boolean | null;
  last_checked_at?: string | null;
};

export type PublicDataHomeRecord = {
  record_id: string;
  canonical_version: number;
  record_type: PublicDataRecordType;
  title: string;
  summary?: string | null;
  category?: string | null;
  life_events?: string[];
  jurisdiction: PublicDataJurisdiction;
  validity?: PublicDataValidity;
  relevance_facts?: Record<string, unknown>;
  requirements?: Record<string, unknown>;
  action_refs?: string[];
  updated_at?: string | null;
  resolved_action?: PublicDataResolvedAction;
};

export type PublicDataHomeResponse = {
  api_version: 'v1';
  projection_version: string;
  generated_at: string;
  comuna_code: string;
  items: PublicDataHomeRecord[];
};
