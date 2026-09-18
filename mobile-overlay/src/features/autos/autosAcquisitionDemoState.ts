import { useSyncExternalStore } from 'react';
import type {
  VehicleAcquisitionRequest,
  VehicleBusinessOffer,
} from '../../../../src/autos/autosSellerModel';

export type DemoVehicleAcquisitionInput = {
  vehicleId?: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  comuna: string;
  askingReferenceClp?: number;
};

export type DemoDealerOfferView = {
  offer: VehicleBusinessOffer;
  businessName: string;
  offerKind: 'preliminary' | 'firm';
  inspectionRequired: boolean;
  offerRespectRatePct: number;
  completedDeals: number;
  responseMinutes: number;
  paymentLabel: string;
  transferLabel: string;
};

export type DemoVehicleAcquisitionView = {
  request: VehicleAcquisitionRequest;
  vehicleLabel: string;
  mileageKm: number;
  offers: readonly DemoDealerOfferView[];
  selectedOfferId?: string;
};

type DemoAcquisitionState = {
  requests: readonly DemoVehicleAcquisitionView[];
};

let state: DemoAcquisitionState = {
  requests: [],
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

function amount(reference: number | undefined, fallback: number, delta: number) {
  return Math.max(1_000_000, Math.round((reference ?? fallback) + delta));
}

export function useAutosAcquisitionDemoState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function createDemoAcquisitionRequest(
  input: DemoVehicleAcquisitionInput,
): DemoVehicleAcquisitionView {
  const now = new Date();
  const stamp = now.getTime().toString(36);
  const requestId = `auto-acquisition-demo-${stamp}`;
  const vehicleId = input.vehicleId ?? `vehicle-acquisition-demo-${stamp}`;
  const baseline = input.askingReferenceClp ?? 18_000_000;

  const request: VehicleAcquisitionRequest = {
    id: requestId,
    vehicleId,
    requesterUserId: 'demo-current-user',
    status: 'open_for_offers',
    comuna: input.comuna,
    createdAt: now.toISOString(),
    closesAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const offers: DemoDealerOfferView[] = [
    {
      offer: {
        id: `${requestId}-offer-a`,
        acquisitionRequestId: requestId,
        businessId: 'demo-business-auto-providencia',
        amountClp: amount(baseline, 18_000_000, -1_140_000),
        status: 'submitted',
        submittedAt: now.toISOString(),
        expiresAt: request.closesAt,
        note: 'Sujeta a revisión presencial de lo informado y fotografiado.',
      },
      businessName: 'Automotora Providencia · Demo',
      offerKind: 'preliminary',
      inspectionRequired: true,
      offerRespectRatePct: 97,
      completedDeals: 126,
      responseMinutes: 18,
      paymentLabel: 'Pago el mismo día tras revisión',
      transferLabel: 'Gestiona transferencia',
    },
    {
      offer: {
        id: `${requestId}-offer-b`,
        acquisitionRequestId: requestId,
        businessId: 'demo-business-auto-maipu',
        amountClp: amount(baseline, 18_000_000, -1_320_000),
        status: 'submitted',
        submittedAt: now.toISOString(),
        expiresAt: request.closesAt,
        note: 'Oferta firme si la inspección coincide con la información declarada.',
      },
      businessName: 'Automotora Maipú · Demo',
      offerKind: 'firm',
      inspectionRequired: true,
      offerRespectRatePct: 99,
      completedDeals: 88,
      responseMinutes: 32,
      paymentLabel: 'Transferencia bancaria al cierre',
      transferLabel: 'Retiro y transferencia coordinados',
    },
    {
      offer: {
        id: `${requestId}-offer-c`,
        acquisitionRequestId: requestId,
        businessId: 'demo-business-auto-las-condes',
        amountClp: amount(baseline, 18_000_000, -1_240_000),
        status: 'submitted',
        submittedAt: now.toISOString(),
        expiresAt: request.closesAt,
        note: 'Puede revisar el vehículo en tu comuna sin compartir tu dirección hasta coordinar.',
      },
      businessName: 'Autos Las Condes · Demo',
      offerKind: 'preliminary',
      inspectionRequired: true,
      offerRespectRatePct: 95,
      completedDeals: 214,
      responseMinutes: 11,
      paymentLabel: 'Pago dentro de 24 horas',
      transferLabel: 'Apoya documentación de transferencia',
    },
  ];

  const view: DemoVehicleAcquisitionView = {
    request,
    vehicleLabel: `${input.make.trim()} ${input.model.trim()} · ${input.year}`,
    mileageKm: input.mileageKm,
    offers,
  };

  state = {
    ...state,
    requests: [view, ...state.requests],
  };
  emit();
  return view;
}

export function findDemoAcquisitionRequest(requestId: string) {
  return state.requests.find((item) => item.request.id === requestId);
}

export function selectDemoDealerOffer(requestId: string, offerId: string) {
  state = {
    ...state,
    requests: state.requests.map((item) =>
      item.request.id === requestId
        ? {
            ...item,
            request: { ...item.request, status: 'offer_selected' },
            selectedOfferId: offerId,
            offers: item.offers.map((entry) => ({
              ...entry,
              offer: {
                ...entry.offer,
                status: entry.offer.id === offerId ? 'accepted' : 'declined',
              },
            })),
          }
        : item,
    ),
  };
  emit();
}
