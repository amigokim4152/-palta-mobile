export type AccessRequirement =
  | 'public'
  | 'optional_auth'
  | 'authenticated';

export type SurfaceKey =
  | 'home'
  | 'neighborhood'
  | 'community'
  | 'market'
  | 'play'
  | 'business_detail'
  | 'place_detail'
  | 'care_detail'
  | 'public_search'
  | 'settings';

const requirements: Record<SurfaceKey, AccessRequirement> = {
  home: 'authenticated',
  neighborhood: 'optional_auth',
  community: 'optional_auth',
  market: 'optional_auth',
  play: 'optional_auth',
  business_detail: 'public',
  place_detail: 'public',
  care_detail: 'authenticated',
  public_search: 'public',
  settings: 'authenticated',
};

export function accessRequirementFor(
  surface: SurfaceKey,
): AccessRequirement {
  return requirements[surface];
}

export function canOpenSurface(
  surface: SurfaceKey,
  signedIn: boolean,
): boolean {
  const requirement = accessRequirementFor(surface);
  return requirement !== 'authenticated' || signedIn;
}
