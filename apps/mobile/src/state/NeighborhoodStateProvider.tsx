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
import type { NeighborhoodState } from './neighborhoodState';

const initialState: NeighborhoodState = {
  effectiveLocation: null,
  searchOrigin: null,
  camera: null,
  viewportBounds: null,
  query: '',
  activeFilters: [],
  selectedEntityId: null,
  resultIds: ['business-taller-1', 'business-pharmacy-1'],
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
