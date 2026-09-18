import type { PaltaUserId } from '../auth/accountModel.js';

export type CoreProfile = {
  paltaUserId: PaltaUserId;
  preferredLanguage: string;
  timezone: string;
  updatedAt: string;
  preferredName?: string;
  profilePhotoRef?: string;
  countryCode?: string;
};

export type LifeAreaKind = 'home' | 'work' | 'saved' | 'exploring';

export type LifeAreaRef = {
  areaId: string;
  paltaUserId: PaltaUserId;
  kind: LifeAreaKind;
  countryCode: string;
  regionCode?: string;
  communeCode?: string;
  neighborhoodLabel?: string;
};

export type VisibleProfile = {
  paltaUserId: PaltaUserId;
  scopeId: string;
  displayName: string;
  profilePhotoRef?: string;
};

export type ProfileFacet =
  | 'household'
  | 'roles'
  | 'organizations'
  | 'things'
  | 'health'
  | 'finance';

export type ProfileFacetBoundary = {
  facet: ProfileFacet;
  embeddedInCoreProfile: false;
};

export const PROFILE_FACET_BOUNDARIES: readonly ProfileFacetBoundary[] = [
  { facet: 'household', embeddedInCoreProfile: false },
  { facet: 'roles', embeddedInCoreProfile: false },
  { facet: 'organizations', embeddedInCoreProfile: false },
  { facet: 'things', embeddedInCoreProfile: false },
  { facet: 'health', embeddedInCoreProfile: false },
  { facet: 'finance', embeddedInCoreProfile: false },
] as const;
