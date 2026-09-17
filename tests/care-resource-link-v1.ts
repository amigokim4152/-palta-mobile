import type { CareResourceAuthorizationPort } from '../src/care/careResourceAuthorizationPort.js';
import type {
  CareResourceLinkPort,
  CareResourceLinkRecord,
} from '../src/care/careResourceLinkPort.js';
import {
  CareResourceLinkError,
  CareResourceLinkService,
} from '../src/care/careResourceLinkService.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class InMemoryLinks implements CareResourceLinkPort {
  owners = new Map<string, string>([['care-1', 'user-1']]);
  links = new Map<string, CareResourceLinkRecord>();

  async findCareTrackOwner(careTrackId: string): Promise<string | null> {
    return this.owners.get(careTrackId) ?? null;
  }

  async attachIfAbsent(input: CareResourceLinkRecord) {
    const key = [
      input.careTrackId,
      input.sourceCore,
      input.resourceType,
      input.resourceId,
      input.relation,
    ].join('|');
    const existing = this.links.get(key);
    if (existing) return { link: existing, created: false };
    this.links.set(key, input);
    return { link: input, created: true };
  }
}

const directory = new InMemoryLinks();
const authCalls: Array<Parameters<CareResourceAuthorizationPort['canLinkResource']>[0]> = [];
let authorize = true;
const authorization: CareResourceAuthorizationPort = {
  async canLinkResource(input) {
    authCalls.push(input);
    return authorize;
  },
};
const service = new CareResourceLinkService(directory, authorization);

const first = await service.link({
  principalUserId: 'user-1',
  careTrackId: 'care-1',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  linkedAt: '2026-09-17T21:30:00.000Z',
});
assert(!first.replayed, 'First authorized Care resource link must be created.');
assert(first.link.relation === 'subject', 'Care resource relation must default to subject.');
assert(Number(authCalls.length) === 1, 'Owning domain authorization must run before attachment.');

const replay = await service.link({
  principalUserId: 'user-1',
  careTrackId: 'care-1',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  linkedAt: '2026-09-17T21:31:00.000Z',
});
assert(replay.replayed, 'Repeated authorized link must be idempotent.');
assert(replay.link.linkedAt === first.link.linkedAt, 'Replay must retain the canonical original link timestamp.');

let wrongOwnerRejected = false;
const callsBeforeWrongOwner = authCalls.length;
try {
  await service.link({
    principalUserId: 'user-2',
    careTrackId: 'care-1',
    sourceCore: 'delivery-core',
    resourceType: 'shipment',
    resourceId: 'shipment-45',
    linkedAt: '2026-09-17T21:32:00.000Z',
  });
} catch (error) {
  wrongOwnerRejected = error instanceof CareResourceLinkError && error.code === 'CARE_TRACK_NOT_OWNED';
}
assert(wrongOwnerRejected, 'A principal must not attach resources to another user\'s Care track.');
assert(
  Number(authCalls.length) === callsBeforeWrongOwner,
  'Domain authorization must not run after Care ownership already failed.',
);

authorize = false;
let domainDenied = false;
try {
  await service.link({
    principalUserId: 'user-1',
    careTrackId: 'care-1',
    sourceCore: 'commerce-core',
    resourceType: 'order',
    resourceId: 'order-other-user',
    linkedAt: '2026-09-17T21:33:00.000Z',
  });
} catch (error) {
  domainDenied = error instanceof CareResourceLinkError && error.code === 'RESOURCE_NOT_AUTHORIZED';
}
assert(domainDenied, 'Owning domain must be able to deny a Care resource association.');

authorize = true;
let urlRejected = false;
try {
  await service.link({
    principalUserId: 'user-1',
    careTrackId: 'care-1',
    sourceCore: 'delivery-core',
    resourceType: 'shipment',
    resourceId: 'https://provider.example/shipment/44',
    linkedAt: '2026-09-17T21:34:00.000Z',
  });
} catch (error) {
  urlRejected = error instanceof CareResourceLinkError && error.code === 'INVALID_LINK';
}
assert(urlRejected, 'Care links must use provider-neutral canonical IDs rather than provider URLs.');

console.log('Care resource-link authorization tests passed.');
