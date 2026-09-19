export type CommunityRuntimeMode = 'preview' | 'live';

export function communityRuntimeMode(environment: string | undefined): CommunityRuntimeMode {
  const resolvedEnvironment = environment ?? 'development';
  return resolvedEnvironment === 'development' || resolvedEnvironment === 'preview'
    ? 'preview'
    : 'live';
}

export function useCommunityPreview(): boolean {
  return communityRuntimeMode(process.env.EXPO_PUBLIC_ENV) === 'preview';
}
