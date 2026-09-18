import { useSyncExternalStore } from 'react';
import type { VehicleSaleMilestoneRecord } from '../../../../src/autos/autosSaleCare';
import { findDemoAcquisitionRequest } from './autosAcquisitionDemoState';

export type DemoVehicleSaleCare = {
  requestId: string;
  selectedOfferId: string;
  finalPriceClp: number;
  records: readonly VehicleSaleMilestoneRecord[];
};

type State = {
  byRequestId: Readonly<Record<string, DemoVehicleSaleCare>>;
};

let state: State = { byRequestId: {} };
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

function nowIso() {
  return new Date().toISOString();
}

export function useAutosSaleCareDemoState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function ensureDemoVehicleSaleCare(requestId: string): DemoVehicleSaleCare | undefined {
  const existing = state.byRequestId[requestId];
  if (existing) return existing;

  const acquisition = findDemoAcquisitionRequest(requestId);
  if (!acquisition?.selectedOfferId) return undefined;
  const offer = acquisition.offers.find((candidate) => candidate.offer.id === acquisition.selectedOfferId);
  if (!offer) return undefined;

  const created: DemoVehicleSaleCare = {
    requestId,
    selectedOfferId: offer.offer.id,
    finalPriceClp: offer.offer.amountClp,
    records: [
      {
        milestone: 'offer_selected',
        observedAt: nowIso(),
        summary: `${offer.businessName} seleccionada`,
      },
    ],
  };

  state = {
    byRequestId: {
      ...state.byRequestId,
      [requestId]: created,
    },
  };
  emit();
  return created;
}

const nextMilestone: Record<VehicleSaleMilestoneRecord['milestone'], VehicleSaleMilestoneRecord['milestone'] | null> = {
  offer_selected: 'inspection_scheduled',
  inspection_scheduled: 'inspection_completed',
  inspection_completed: 'final_price_confirmed',
  final_price_confirmed: 'payment_confirmed',
  payment_confirmed: 'transfer_started',
  transfer_started: 'transfer_registered',
  transfer_registered: 'vehicle_handed_over',
  vehicle_handed_over: null,
};

const milestoneSummary: Record<VehicleSaleMilestoneRecord['milestone'], string> = {
  offer_selected: 'Automotora elegida',
  inspection_scheduled: 'Inspección coordinada',
  inspection_completed: 'Inspección completada',
  final_price_confirmed: 'Precio final confirmado',
  payment_confirmed: 'Pago confirmado',
  transfer_started: 'Transferencia iniciada',
  transfer_registered: 'Transferencia inscrita',
  vehicle_handed_over: 'Vehículo entregado',
};

export function advanceDemoVehicleSaleCare(requestId: string): DemoVehicleSaleCare | undefined {
  const current = ensureDemoVehicleSaleCare(requestId);
  if (!current) return undefined;
  const latest = current.records[current.records.length - 1];
  if (!latest) return current;
  const next = nextMilestone[latest.milestone];
  if (!next) return current;

  const updated: DemoVehicleSaleCare = {
    ...current,
    records: [
      ...current.records,
      {
        milestone: next,
        observedAt: nowIso(),
        summary: milestoneSummary[next],
      },
    ],
  };
  state = {
    byRequestId: {
      ...state.byRequestId,
      [requestId]: updated,
    },
  };
  emit();
  return updated;
}
