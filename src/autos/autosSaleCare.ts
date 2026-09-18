import type { CareState, CareTrack } from '../care/careMachine.js';

export type VehicleSaleMilestone =
  | 'offer_selected'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'final_price_confirmed'
  | 'payment_confirmed'
  | 'transfer_started'
  | 'transfer_registered'
  | 'vehicle_handed_over';

export type VehicleSaleMilestoneRecord = {
  milestone: VehicleSaleMilestone;
  observedAt: string;
  summary?: string;
};

export type VehicleSaleCareInput = {
  careId: string;
  acquisitionRequestId: string;
  selectedOfferId: string;
  records: readonly VehicleSaleMilestoneRecord[];
};

const milestoneOrder: readonly VehicleSaleMilestone[] = [
  'offer_selected',
  'inspection_scheduled',
  'inspection_completed',
  'final_price_confirmed',
  'payment_confirmed',
  'transfer_started',
  'transfer_registered',
  'vehicle_handed_over',
];

export function validateVehicleSaleMilestones(
  records: readonly VehicleSaleMilestoneRecord[],
): { valid: boolean; reason?: string } {
  let lastIndex = -1;
  const seen = new Set<VehicleSaleMilestone>();

  for (const record of records) {
    if (seen.has(record.milestone)) {
      return { valid: false, reason: `Duplicate vehicle sale milestone: ${record.milestone}` };
    }
    const currentIndex = milestoneOrder.indexOf(record.milestone);
    if (currentIndex < lastIndex) {
      return { valid: false, reason: 'Vehicle sale milestones must remain chronological.' };
    }
    seen.add(record.milestone);
    lastIndex = currentIndex;
  }

  return { valid: true };
}

export function projectVehicleSaleCareState(
  records: readonly VehicleSaleMilestoneRecord[],
): CareState {
  const completed = new Set(records.map((record) => record.milestone));

  if (completed.has('vehicle_handed_over')) return 'completed';
  if (completed.has('transfer_registered')) return 'result_available';
  if (completed.has('transfer_started')) return 'waiting';
  if (completed.has('payment_confirmed')) return 'preparing';
  if (completed.has('final_price_confirmed')) return 'preparing';
  if (completed.has('inspection_completed')) return 'result_available';
  if (completed.has('inspection_scheduled')) return 'upcoming';
  if (completed.has('offer_selected')) return 'preparing';
  return 'discovered';
}

export function buildVehicleSaleCareTrack(input: VehicleSaleCareInput): CareTrack {
  const validation = validateVehicleSaleMilestones(input.records);
  if (!validation.valid) throw new Error(validation.reason);

  const state = projectVehicleSaleCareState(input.records);
  const latest = input.records[input.records.length - 1];

  if (state === 'result_available' && latest) {
    return {
      id: input.careId,
      state,
      result: {
        code: latest.milestone,
        summary: latest.summary ?? latest.milestone,
        observedAt: latest.observedAt,
      },
    };
  }

  return {
    id: input.careId,
    state,
    ...(state === 'upcoming' && latest ? { expectedAt: latest.observedAt } : {}),
    ...(state === 'waiting' ? { waitingFor: 'transfer_registration' } : {}),
  };
}

export const VEHICLE_SALE_CARE_CHECKLIST: readonly {
  milestone: VehicleSaleMilestone;
  userLabel: string;
}[] = [
  { milestone: 'offer_selected', userLabel: 'Automotora elegida' },
  { milestone: 'inspection_scheduled', userLabel: 'Inspección coordinada' },
  { milestone: 'inspection_completed', userLabel: 'Inspección completada' },
  { milestone: 'final_price_confirmed', userLabel: 'Precio final confirmado' },
  { milestone: 'payment_confirmed', userLabel: 'Pago confirmado' },
  { milestone: 'transfer_started', userLabel: 'Transferencia iniciada' },
  { milestone: 'transfer_registered', userLabel: 'Transferencia inscrita' },
  { milestone: 'vehicle_handed_over', userLabel: 'Vehículo entregado' },
] as const;
