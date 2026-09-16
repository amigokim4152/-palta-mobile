export type CommunityTrustScope =
  | 'public_local'
  | 'verified_local'
  | 'member_group'
  | 'private_relation';

export type CommunitySurface = {
  key: string;
  title: string;
  scope: CommunityTrustScope;
  requiresMembership: boolean;
  canAppearInPublicDiscovery: boolean;
};

export function canOpenCommunitySurface(input: {
  surface: CommunitySurface;
  isSignedIn: boolean;
  isMember: boolean;
}): boolean {
  const { surface } = input;

  if (surface.scope === 'public_local') return true;
  if (surface.scope === 'verified_local') return input.isSignedIn;

  if (surface.requiresMembership) {
    return input.isSignedIn && input.isMember;
  }

  return input.isSignedIn;
}

export function canPubliclyDiscoverCommunity(
  surface: CommunitySurface,
): boolean {
  return surface.canAppearInPublicDiscovery &&
    surface.scope !== 'private_relation' &&
    surface.scope !== 'member_group';
}
