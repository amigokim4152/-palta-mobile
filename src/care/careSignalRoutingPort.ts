export interface CareSignalTarget {
  careTrackId: string;
}

export interface CareSignalRoutingPort {
  findTargetsForResource(input: {
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    maxTargets: number;
  }): Promise<CareSignalTarget[]>;
}
