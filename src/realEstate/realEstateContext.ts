import type {
  Building,
  PlaceId,
  PropertyId,
} from './realEstateContracts.js';

export type RealEstateContextSourceCore =
  | 'map'
  | 'transport'
  | 'business'
  | 'education'
  | 'health'
  | 'municipal';

export type RealEstateNearbyKind =
  | 'transit'
  | 'school'
  | 'health'
  | 'park'
  | 'grocery'
  | 'business';

export type RealEstateContextVerification =
  | 'verified'
  | 'corroborated'
  | 'needs_verification'
  | 'demo';

export type RealEstateContextEvidence = {
  verification: RealEstateContextVerification;
  sourceId?: string;
  observedAt?: string;
};

export type RealEstateBuildingContext = {
  building: Building;
  yearBuilt?: number;
  floors?: number;
  unitCount?: number;
  evidence: RealEstateContextEvidence;
};

/**
 * Reference to a nearby entity owned by another Palta core. Real Estate keeps
 * the relationship and useful distance, but does not fork the source entity.
 */
export type RealEstateNearbyRef = {
  kind: RealEstateNearbyKind;
  sourceCore: RealEstateContextSourceCore;
  entityId: string;
  placeId?: PlaceId;
  displayLabel?: string;
  distanceMeters?: number;
  walkingMinutes?: number;
  evidence: RealEstateContextEvidence;
};

export type RealEstatePropertyContext = {
  propertyId: PropertyId;
  building?: RealEstateBuildingContext;
  nearby: readonly RealEstateNearbyRef[];
  generatedAt: string;
};

export interface RealEstateContextRepository {
  getByPropertyId(propertyId: PropertyId): Promise<RealEstatePropertyContext | null>;
}

export function nearbyByKind(
  context: RealEstatePropertyContext,
  kind: RealEstateNearbyKind,
): readonly RealEstateNearbyRef[] {
  return context.nearby.filter((item) => item.kind === kind);
}

export function realEstateContextIsFresh(
  context: RealEstatePropertyContext,
  now: string,
  maxAgeMs: number,
): boolean {
  const generatedAt = Date.parse(context.generatedAt);
  const current = Date.parse(now);
  if (!Number.isFinite(generatedAt) || !Number.isFinite(current) || maxAgeMs < 0) return false;
  return current - generatedAt <= maxAgeMs;
}
