import {
  CommunityApiService,
  type CommunityAuthorizationPort,
  type CommunityRepository,
} from './communityBoundary.js';
import { handleCommunityRequest } from './communityHttp.js';
import {
  PaltaApiIdentityResolver,
  type BearerSessionVerifier,
  type PaltaIdentityStore,
} from './paltaIdentityResolver.js';

export type CommunityHttpRuntimeDependencies = {
  repository: CommunityRepository;
  authorization: CommunityAuthorizationPort;
  verifier: BearerSessionVerifier;
  identities: PaltaIdentityStore;
};

export type CommunityHttpRuntime = {
  handle(request: Request): Promise<Response | null>;
};

/**
 * Canonical server composition point for /v1/community/*.
 *
 * Hosting is deliberately separate from the PMTiles map Worker. A Node service,
 * dedicated Cloudflare API Worker, or other approved server host can provide the
 * concrete Supabase SQL/Auth adapters without changing Community application logic.
 */
export function createCommunityHttpRuntime(
  dependencies: CommunityHttpRuntimeDependencies,
): CommunityHttpRuntime {
  const service = new CommunityApiService(
    dependencies.repository,
    dependencies.authorization,
  );
  const identityResolver = new PaltaApiIdentityResolver(
    dependencies.verifier,
    dependencies.identities,
  );

  return {
    handle(request: Request) {
      return handleCommunityRequest({ request, service, identityResolver });
    },
  };
}
