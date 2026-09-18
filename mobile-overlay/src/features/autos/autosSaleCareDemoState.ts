import { useSyncExternalStore } from 'react';
import type { VehicleSaleMilestoneRecord } from '../../../../src/autos/autosSaleCare';
import {
  validateVehicleOfferAdjustment,
  type VehicleOfferAdjustment,
} from '../../../../src/autos/autosSellerModel';
import { findDemoAcquisitionRequest } from './autosAcquisitionDemoState';

export type DemoVehiclePriceReviewStatus = 'pending' | 'accepted' | 'review_requested';

export type DemoVehiclePriceReview = {
  originalOfferClp: number;
  proposedFinalPriceClp: number;
  adjustments: readonly VehicleOfferAdjustment[];
  status: DemoVehiclePriceReviewStatus;
};

export type DemoVehicleSaleCare = {
  requestId: string;
  selectedOfferId: string;
  finalPriceClp: number;
  records: readonly VehicleSaleMilestoneRecord[];
  priceReview?: DemoVehiclePriceReview;
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

function replaceCare(requestId: string, care: DemoVehicleSaleCare) {
  state = {
    byRequestId: {
      ...state.byRequestId,
      [requestId]: care,
    },
  };
  emit();
  return care;
}

function demoPriceReview(offerId: string, originalOfferClp: number): DemoVehiclePriceReview {
  const deductionClp = Math.min(180_000, Math.max(50_000, Math.round(originalOfferClp * 0.01)));
  const adjustment: VehicleOfferAdjustment = {
    id: `demo-adjustment-${offerId}`,
    offerId,
    previousAmountClp: originalOfferClp,
    revisedAmountClp: originalOfferClp - deductionClp,
    reason: 'undisclosed_damage',
    explanation: 'La inspección demo detectó un daño exterior que no aparecía con claridad en las fotos iniciales.',
    evidenceRefs: ['demo://inspection/exterior-damage-1'],
    createdAt: nowIso(),
  };
  const validation = validateVehicleOfferAdjustment(adjustment);
  if (!validation.valid) throw new Error(validation.reason);

  return {
    originalOfferClp,
    proposedFinalPriceClp: adjustment.revisedAmountClp,
    adjustments: [adjustment],
    status: 'pending',
  };
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

  return replaceCare(requestId, created);
}

const nextMilestone: Record<VehicleSaleMilestoneRecord['milestone'], VehicleSaleMilestoneRecord['milestone'] | null> = {
  offer_selected: 'inspection_scheduled',
  inspection_scheduled: 'inspection_completed',
  inspection_completed: null,
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
    ...(next === 'inspection_completed' && !current.priceReview
      ? { priceReview: demoPriceReview(current.selectedOfferId, current.finalPriceClp) }
      : {}),
  };
  return replaceCare(requestId, updated);
}

export function acceptDemoVehicleFinalPrice(requestId: string): DemoVehicleSaleCare | undefined {
  const current = ensureDemoVehicleSaleCare(requestId);
  if (!current?.priceReview || current.priceReview.status === 'accepted') return current;
  const latest = current.records[current.records.length - 1];
  if (latest?.milestone !== 'inspection_completed') return current;

  return replaceCare(requestId, {
    ...current,
    finalPriceClp: current.priceReview.proposedFinalPriceClp,
    priceReview: { ...current.priceReview, status: 'accepted' },
    records: [
      ...current.records,
      {
        milestone: 'final_price_confirmed',
        observedAt: nowIso(),
        summary: 'Precio final revisado y confirmado',
      },
    ],
  });
}

export function requestDemoVehiclePriceReview(requestId: string): DemoVehicleSaleCare | undefined {
  const current = ensureDemoVehicleSaleCare(requestId);
  if (!current?.priceReview) return current;
  return replaceCare(requestId, {
    ...current,
    priceReview: { ...current.priceReview, status: 'review_requested' },
  });
}
