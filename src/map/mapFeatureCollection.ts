import type { MapFeature } from '../adapters/mapCore.js';

export type PaltaPointFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: {
      entityId: string;
      entityType: MapFeature['entityType'];
      title: string;
      categoryKey?: string;
      verificationStatus?: string;
      operationalState?: string;
      selected: boolean;
    };
  }>;
};

export function toPointFeatureCollection(
  features: readonly MapFeature[],
): PaltaPointFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      id: feature.id,
      geometry: {
        type: 'Point',
        coordinates: [
          feature.coordinate.longitude,
          feature.coordinate.latitude,
        ],
      },
      properties: {
        entityId: feature.id,
        entityType: feature.entityType,
        title: feature.title,
        ...(feature.categoryKey ? { categoryKey: feature.categoryKey } : {}),
        ...(feature.verificationStatus
          ? { verificationStatus: feature.verificationStatus }
          : {}),
        ...(feature.operationalState
          ? { operationalState: feature.operationalState }
          : {}),
        selected: feature.selected === true,
      },
    })),
  };
}
