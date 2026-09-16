export type PlaySection =
  | 'eat_drink'
  | 'events_culture'
  | 'family'
  | 'travel_stays';

export type ContextSpaceKind =
  | 'travel'
  | 'moving'
  | 'treatment'
  | 'school_event'
  | 'vehicle_repair';

export type ContextSpace = {
  id: string;
  kind: ContextSpaceKind;
  title: string;
  startsAt?: string;
  endsAt?: string;
  locationRef?: string;
  relatedEntityIds: string[];
};

export function shouldPromoteContextSpace(input: {
  hasConfirmedAction: boolean;
  hasSavedOnly: boolean;
  hasDateOrActiveState: boolean;
}): boolean {
  if (!input.hasConfirmedAction) return false;
  if (!input.hasDateOrActiveState) return false;
  return true;
}
