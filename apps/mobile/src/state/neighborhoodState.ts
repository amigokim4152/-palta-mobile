export type SheetSnap = "peek" | "half" | "full";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type CameraState = {
  center: GeoPoint;
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export type Bounds = {
  northEast: GeoPoint;
  southWest: GeoPoint;
};

export type NeighborhoodState = {
  effectiveLocation: GeoPoint | null;
  searchOrigin: GeoPoint | null;
  camera: CameraState | null;
  viewportBounds: Bounds | null;
  query: string;
  activeFilters: string[];
  selectedEntityId: string | null;
  resultIds: string[];
  sheetSnap: SheetSnap;
  mapMovedSinceSearch: boolean;
  loading: "idle" | "loading" | "refreshing";
  degraded: boolean;
};
