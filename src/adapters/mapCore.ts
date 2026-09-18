export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MapCamera = {
  center: GeoPoint;
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export type MapBounds = {
  northEast: GeoPoint;
  southWest: GeoPoint;
};

export type MapFeature = {
  id: string;
  entityType: 'place' | 'business' | 'public_service' | 'event' | 'property_listing' | 'vehicle_listing';
  coordinate: GeoPoint;
  title: string;
  categoryKey?: string;
  selected?: boolean;
};

export interface MapCoreAdapter {
  setCamera(camera: MapCamera): Promise<void> | void;
  fitBounds(bounds: MapBounds): Promise<void> | void;
  setFeatures(features: readonly MapFeature[]): Promise<void> | void;
  setSelectedEntity(entityId: string | null): Promise<void> | void;
}

export type MapBrowseState = {
  camera: MapCamera | null;
  bounds: MapBounds | null;
  selectedEntityId: string | null;
  mapMovedSinceSearch: boolean;
};

export function markMapMoved(state: MapBrowseState): MapBrowseState {
  return { ...state, mapMovedSinceSearch: true };
}

export function applyViewportSearch(
  state: MapBrowseState,
  bounds: MapBounds,
): MapBrowseState {
  return { ...state, bounds, mapMovedSinceSearch: false };
}

export function selectMapEntity(
  state: MapBrowseState,
  entityId: string | null,
): MapBrowseState {
  return { ...state, selectedEntityId: entityId };
}
