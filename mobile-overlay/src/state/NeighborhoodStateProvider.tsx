import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';
import {
  reduceNeighborhood,
  type NeighborhoodAction,
} from '../features/neighborhood/reduceNeighborhood';
import type { GeoPoint, NeighborhoodState } from './neighborhoodState';

const SANTIAGO_DEVELOPMENT_ORIGIN: GeoPoint = {
  latitude: -33.4372,
  longitude: -70.6506,
};

// Simulator/development needs a useful first frame for product review without
// requesting GPS. Production still begins without an assumed precise location.
const developmentOrigin =
  process.env.EXPO_PUBLIC_ENV === 'development'
    ? SANTIAGO_DEVELOPMENT_ORIGIN
    : null;

const initialState: NeighborhoodState = {
  effectiveLocation: developmentOrigin,
  searchOrigin: developmentOrigin,
  camera: developmentOrigin
    ? {
        center: developmentOrigin,
        zoom: 12.4,
      }
    : null,
  viewportBounds: null,
  query: '',
  activeFilters: [],
  selectedEntityId: null,
  resultIds: [],
  sheetSnap: 'half',
  mapMovedSinceSearch: false,
  loading: 'idle',
  degraded: false,
};

type Value = {
  state: NeighborhoodState;
  dispatch: (action: NeighborhoodAction) => void;
};

const NeighborhoodContext = createContext<Value | null>(null);

export function NeighborhoodStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reduceNeighborhood, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <NeighborhoodContext.Provider value={value}>
      {children}
    </NeighborhoodContext.Provider>
  );
}

export function useNeighborhoodState() {
  const value = useContext(NeighborhoodContext);
  if (!value) {
    throw new Error('useNeighborhoodState must be used inside NeighborhoodStateProvider');
  }
  return value;
}
