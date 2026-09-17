import type {
  GeoPoint,
  NeighborhoodState,
  SheetSnap,
} from '../../state/neighborhoodState';

export type NeighborhoodAction =
  | { type: 'set_effective_location'; location: GeoPoint }
  | {
      type: 'set_viewport_center';
      center: GeoPoint;
      zoom?: number;
      userInteraction: boolean;
    }
  | { type: 'select_entity'; entityId: string | null }
  | { type: 'set_query'; query: string }
  | { type: 'set_filters'; filters: string[] }
  | { type: 'set_sheet_snap'; snap: SheetSnap }
  | { type: 'map_moved' }
  | { type: 'search_current_viewport'; resultIds: string[] }
  | { type: 'set_degraded'; degraded: boolean };

export function reduceNeighborhood(
  state: NeighborhoodState,
  action: NeighborhoodAction,
): NeighborhoodState {
  switch (action.type) {
    case 'set_effective_location':
      return {
        ...state,
        effectiveLocation: action.location,
        searchOrigin: action.location,
        camera: {
          center: action.location,
          zoom: state.camera?.zoom ?? 14,
        },
        selectedEntityId: null,
        mapMovedSinceSearch: false,
      };
    case 'set_viewport_center':
      return {
        ...state,
        camera: {
          center: action.center,
          zoom: action.zoom ?? state.camera?.zoom ?? 14,
        },
        mapMovedSinceSearch:
          state.mapMovedSinceSearch || action.userInteraction,
      };
    case 'select_entity':
      return { ...state, selectedEntityId: action.entityId };
    case 'set_query':
      return {
        ...state,
        query: action.query,
        selectedEntityId: null,
        sheetSnap: 'half',
      };
    case 'set_filters':
      return { ...state, activeFilters: action.filters };
    case 'set_sheet_snap':
      return { ...state, sheetSnap: action.snap };
    case 'map_moved':
      return { ...state, mapMovedSinceSearch: true };
    case 'search_current_viewport':
      return {
        ...state,
        searchOrigin: state.camera?.center ?? state.effectiveLocation,
        resultIds: action.resultIds,
        selectedEntityId: null,
        mapMovedSinceSearch: false,
      };
    case 'set_degraded':
      return { ...state, degraded: action.degraded };
  }
}
