import type { CareState } from '../care/careMachine.js';

export const LOCAL_BUSINESS_SLICE = [
  'home',
  'neighborhood',
  'business_detail',
  'user_action',
  'care_projection',
  'home_return',
  'follow_up',
] as const;

export type LocalBusinessSliceStep = typeof LOCAL_BUSINESS_SLICE[number];

export interface BusinessFlowProjection {
  businessId: string;
  careTrackId?: string;
  careState?: CareState;
  homeCandidateId?: string;
}

export function canonicalBusinessIsStable(
  discoveredBusinessId: string,
  detailBusinessId: string,
  projectionBusinessId: string,
): boolean {
  return discoveredBusinessId === detailBusinessId && detailBusinessId === projectionBusinessId;
}
