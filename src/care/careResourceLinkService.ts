import type { CareResourceAuthorizationPort } from './careResourceAuthorizationPort.js';
import type {
  CareResourceLinkPort,
  CareResourceLinkRecord,
} from './careResourceLinkPort.js';

export class CareResourceLinkError extends Error {
  constructor(
    readonly code:
      | 'INVALID_LINK'
      | 'CARE_TRACK_NOT_FOUND'
      | 'CARE_TRACK_NOT_OWNED'
      | 'RESOURCE_NOT_AUTHORIZED',
    message: string,
  ) {
    super(message);
    this.name = 'CareResourceLinkError';
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CareResourceLinkError('INVALID_LINK', `${label} is required.`);
  }
  return normalized;
}

function rejectUrl(value: string, label: string): void {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw new CareResourceLinkError(
      'INVALID_LINK',
      `${label} must be a provider-neutral canonical ID, not a URL.`,
    );
  }
}

export class CareResourceLinkService {
  constructor(
    private readonly directory: CareResourceLinkPort,
    private readonly authorization: CareResourceAuthorizationPort,
  ) {}

  async link(input: {
    principalUserId: string;
    careTrackId: string;
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    relation?: string;
    linkedAt: string;
  }): Promise<{
    link: CareResourceLinkRecord;
    replayed: boolean;
  }> {
    const principalUserId = required(input.principalUserId, 'principalUserId');
    const careTrackId = required(input.careTrackId, 'careTrackId');
    const sourceCore = required(input.sourceCore, 'sourceCore');
    const resourceType = required(input.resourceType, 'resourceType');
    const resourceId = required(input.resourceId, 'resourceId');
    const relation = required(input.relation ?? 'subject', 'relation');
    const linkedAt = required(input.linkedAt, 'linkedAt');
    rejectUrl(resourceId, 'resourceId');

    const ownerUserId = await this.directory.findCareTrackOwner(careTrackId);
    if (!ownerUserId) {
      throw new CareResourceLinkError(
        'CARE_TRACK_NOT_FOUND',
        'Care track does not exist.',
      );
    }
    if (ownerUserId !== principalUserId) {
      throw new CareResourceLinkError(
        'CARE_TRACK_NOT_OWNED',
        'Authenticated principal does not own the Care track.',
      );
    }

    const allowed = await this.authorization.canLinkResource({
      principalUserId,
      sourceCore,
      resourceType,
      resourceId,
    });
    if (!allowed) {
      throw new CareResourceLinkError(
        'RESOURCE_NOT_AUTHORIZED',
        'Owning domain did not authorize this Care resource link.',
      );
    }

    const attached = await this.directory.attachIfAbsent({
      careTrackId,
      sourceCore,
      resourceType,
      resourceId,
      relation,
      linkedAt,
    });
    return {
      link: attached.link,
      replayed: !attached.created,
    };
  }
}
