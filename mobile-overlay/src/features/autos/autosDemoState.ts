import { useSyncExternalStore } from 'react';
import type { VehicleListingView } from '../../../../src/autos/autosContracts';

export type DemoVehicleDraftInput = {
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  priceClp: number;
  comuna: string;
  description: string;
};

type AutosDemoState = {
  savedListingIds: readonly string[];
  publishedListings: readonly VehicleListingView[];
};

let state: AutosDemoState = {
  savedListingIds: ['auto-demo-rav4-las-condes', 'auto-demo-mg-zs-providencia'],
  publishedListings: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useAutosDemoState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function isAutosListingSaved(listingId: string) {
  return state.savedListingIds.includes(listingId);
}

export function toggleAutosListingSaved(listingId: string) {
  const saved = state.savedListingIds.includes(listingId);
  state = {
    ...state,
    savedListingIds: saved
      ? state.savedListingIds.filter((id) => id !== listingId)
      : [...state.savedListingIds, listingId],
  };
  emit();
}

export function publishDemoVehicle(input: DemoVehicleDraftInput): VehicleListingView {
  const now = new Date();
  const stamp = now.getTime().toString(36);
  const normalizedMake = input.make.trim() || 'Vehículo';
  const normalizedModel = input.model.trim() || 'Sin modelo';

  const item: VehicleListingView = {
    vehicle: {
      id: `vehicle-user-demo-${stamp}`,
      make: normalizedMake,
      model: normalizedModel,
      year: input.year,
      bodyType: 'suv',
      transmission: 'automatic',
      fuel: 'gasoline',
    },
    listing: {
      id: `auto-user-demo-${stamp}`,
      vehicleId: `vehicle-user-demo-${stamp}`,
      title: `${normalizedMake} ${normalizedModel} ${input.year}`,
      priceClp: input.priceClp,
      mileageKm: input.mileageKm,
      comuna: input.comuna.trim() || 'Santiago',
      sellerType: 'owner_direct',
      verifiedSeller: true,
      publishedAt: now.toISOString(),
      imageUrls: [
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
      ],
      highlights: ['Publicado desde demo', 'Dueño directo'],
      description: input.description.trim() || 'Publicación creada desde el flujo demo de Autos.',
    },
  };

  state = {
    ...state,
    publishedListings: [item, ...state.publishedListings],
  };
  emit();
  return item;
}
