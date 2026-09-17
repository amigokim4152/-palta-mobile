export interface CareResourceLinkRecord {
  careTrackId: string;
  sourceCore: string;
  resourceType: string;
  resourceId: string;
  relation: string;
  linkedAt: string;
}

export interface CareResourceLinkPort {
  findCareTrackOwner(careTrackId: string): Promise<string | null>;

  attachIfAbsent(input: CareResourceLinkRecord): Promise<{
    link: CareResourceLinkRecord;
    created: boolean;
  }>;
}
