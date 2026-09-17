import {
  businessOperationalSortRank,
  isOrdinarilyDiscoverableBusinessState,
  type BusinessOperationalState,
} from './businessOperationalState.js';
import type { LocalBusinessDiscoveryPreview } from './localBusinessDiscoveryPreview.js';

export type LocalBusinessDiscoveryItem = {
  entityId: string;
  entityType: 'place' | 'business' | 'public_service' | 'event';
  name: string;
  /** Internal classification only; never render this key directly as consumer copy. */
  categoryKey?: string;
  distanceM?: number;
  verificationStatus?: string;
  operationalState?: BusinessOperationalState;
  operationalConfirmedAt?: string;
  /**
   * Bounded presentation projection derived from the same canonical Business.
   * Search/list/map surfaces consume this instead of N+1 detail requests.
   */
  preview?: LocalBusinessDiscoveryPreview;
  /**
   * Exact public point is optional. Service-area, private-home and hidden-location
   * businesses can remain discoverable in the list without exposing a precise pin.
   */
  location?: { lat: number; lng: number };
};

export type LocalBusinessShortcut = {
  id: string;
  label: string;
  query: string;
};

export const LOCAL_BUSINESS_SHORTCUTS: readonly LocalBusinessShortcut[] = [
  { id: 'food', label: 'Comida', query: 'comida restaurante' },
  { id: 'beauty', label: 'Belleza', query: 'peluquería belleza barbería' },
  { id: 'home', label: 'Hogar', query: 'reparación mantención hogar' },
  { id: 'auto', label: 'Auto', query: 'taller neumáticos auto' },
  { id: 'pets', label: 'Mascotas', query: 'veterinaria mascotas' },
  { id: 'classes', label: 'Clases', query: 'clases academia educación' },
] as const;

export function projectLocalBusinesses<T extends LocalBusinessDiscoveryItem>(
  items: readonly T[],
  input?: { verifiedOnly?: boolean; openNowOnly?: boolean },
): T[] {
  return items
    .filter((item) => item.entityType === 'business')
    .filter((item) => isOrdinarilyDiscoverableBusinessState(item.operationalState))
    .filter(
      (item) => !input?.verifiedOnly || item.verificationStatus === 'verified',
    )
    .filter(
      (item) => !input?.openNowOnly || item.operationalState === 'open_now',
    )
    .slice()
    .sort((a, b) => {
      const operationalDelta =
        businessOperationalSortRank(a.operationalState) -
        businessOperationalSortRank(b.operationalState);
      if (operationalDelta !== 0) return operationalDelta;

      const aDistance = a.distanceM ?? Number.POSITIVE_INFINITY;
      const bDistance = b.distanceM ?? Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      return a.name.localeCompare(b.name, 'es-CL');
    });
}
