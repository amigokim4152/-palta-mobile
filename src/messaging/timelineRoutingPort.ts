export interface TimelineProjectionTarget {
  conversationId: string;
  scopeId: string;
}

export interface TimelineRoutingPort {
  findTargetsForResource(input: {
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    maxTargets: number;
  }): Promise<TimelineProjectionTarget[]>;
}
