import { createCommunityHttpRuntime } from '../infra/api/communityRuntime.js';
import type {
  CommunityAuthorizationPort,
  CommunityRepository,
} from '../infra/api/communityBoundary.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repository: CommunityRepository = {
  async transaction<T>(): Promise<T> {
    throw new Error('Repository should not run for an unauthenticated composition smoke.');
  },
};

const authorization: CommunityAuthorizationPort = {
  async assertCanReadSpace() {},
  async assertCanReadThread() {},
  async assertCanJoin() {},
  async assertCanManageMemberships() {},
  async assertCanComment() {},
  async assertCanReact() {},
};

const runtime = createCommunityHttpRuntime({
  repository,
  authorization,
  verifier: { async verify() { return null; } },
  identities: {
    async accountExists() { return false; },
    async accountIsActive() { return false; },
  },
});

const unrelated = await runtime.handle(new Request('https://api.somospalta.cl/health'));
assert(unrelated === null, 'Community runtime must not swallow unrelated host routes.');

const unauthenticated = await runtime.handle(new Request('https://api.somospalta.cl/v1/community/tab'));
assert(unauthenticated?.status === 401, 'Community runtime composition must enforce bearer identity before repository access.');

console.log('PASS: Community server runtime composition tests');
