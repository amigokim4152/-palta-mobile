import type {
  ChileDteType,
  FolioReservation,
  FolioReservationRequest,
} from './fiscalModel.js';

export type FolioRangeStatus = 'active' | 'exhausted' | 'disabled';

export type FolioRangeState = {
  businessId: string;
  issuerRut: string;
  documentType: ChileDteType;
  cafRef: string;
  firstFolio: number;
  lastFolio: number;
  nextFolio: number;
  revision: number;
  status: FolioRangeStatus;
};

export type FolioReservationRecord = FolioReservation & {
  businessId: string;
  issuerRut: string;
  documentType: ChileDteType;
  fiscalRequestId: string;
  idempotencyKey: string;
};

export type FolioAllocationResult = {
  range: FolioRangeState;
  reservation: FolioReservationRecord;
  reused: boolean;
};

/**
 * Persistence boundary for CAF/folio allocation.
 *
 * Production implementations MUST atomically:
 * 1. check an existing reservation by fiscalRequestId/idempotencyKey;
 * 2. compare the expected range revision;
 * 3. reserve exactly one folio;
 * 4. advance nextFolio;
 * 5. persist the reservation and range in the same transaction.
 */
export interface FolioStore {
  reserveNext(
    request: FolioReservationRequest,
  ): Promise<FolioReservationRecord>;
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer.`);
  }
}

export function validateFolioRange(range: FolioRangeState): void {
  assertPositiveSafeInteger(range.firstFolio, 'firstFolio');
  assertPositiveSafeInteger(range.lastFolio, 'lastFolio');
  assertPositiveSafeInteger(range.nextFolio, 'nextFolio');
  if (range.firstFolio > range.lastFolio) {
    throw new Error('Folio range firstFolio cannot exceed lastFolio.');
  }
  if (range.nextFolio < range.firstFolio || range.nextFolio > range.lastFolio + 1) {
    throw new Error('Folio range nextFolio is outside the authorized range.');
  }
  if (!Number.isSafeInteger(range.revision) || range.revision < 0) {
    throw new Error('Folio range revision must be a non-negative safe integer.');
  }
}

function reservationMatchesRequest(
  reservation: FolioReservationRecord,
  request: FolioReservationRequest,
): boolean {
  return (
    reservation.businessId === request.businessId &&
    reservation.issuerRut === request.issuerRut &&
    reservation.documentType === request.documentType &&
    reservation.fiscalRequestId === request.fiscalRequestId &&
    reservation.idempotencyKey === request.idempotencyKey
  );
}

export function reserveNextFolioInState(input: {
  range: FolioRangeState;
  request: FolioReservationRequest;
  existingReservation?: FolioReservationRecord | null;
  reservedAt: string;
}): FolioAllocationResult {
  const { range, request, existingReservation, reservedAt } = input;
  validateFolioRange(range);

  if (existingReservation) {
    if (!reservationMatchesRequest(existingReservation, request)) {
      throw new Error('Existing folio reservation conflicts with this request.');
    }
    return {
      range,
      reservation: existingReservation,
      reused: true,
    };
  }

  if (
    range.businessId !== request.businessId ||
    range.issuerRut !== request.issuerRut ||
    range.documentType !== request.documentType
  ) {
    throw new Error('Folio request does not match the selected CAF range.');
  }
  if (range.status !== 'active') {
    throw new Error(`Folio range is not active: ${range.status}.`);
  }
  if (range.nextFolio > range.lastFolio) {
    throw new Error('Authorized folio range is exhausted.');
  }

  const folio = range.nextFolio;
  const nextFolio = folio + 1;
  const nextRange: FolioRangeState = {
    ...range,
    nextFolio,
    revision: range.revision + 1,
    status: nextFolio > range.lastFolio ? 'exhausted' : 'active',
  };
  const reservation: FolioReservationRecord = {
    businessId: request.businessId,
    issuerRut: request.issuerRut,
    documentType: request.documentType,
    fiscalRequestId: request.fiscalRequestId,
    idempotencyKey: request.idempotencyKey,
    folio,
    cafRef: range.cafRef,
    reservedAt,
  };

  return { range: nextRange, reservation, reused: false };
}
