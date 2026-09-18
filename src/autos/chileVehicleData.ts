export type ChileVehicleDataSource =
  | 'user_confirmed'
  | 'sii_tasacion'
  | 'partner_registry'
  | 'business_inventory'
  | 'inspection';

export type VehicleFactConfidence =
  | 'declared'
  | 'matched'
  | 'verified';

export type VehicleFact<T> = {
  value: T;
  source: ChileVehicleDataSource;
  confidence: VehicleFactConfidence;
  observedAt: string;
  effectiveYear?: number;
  sourceRef?: string;
};

export type ChileVehicleIdentitySnapshot = {
  plateMasked: string;
  make?: VehicleFact<string>;
  model?: VehicleFact<string>;
  version?: VehicleFact<string>;
  manufactureYear?: VehicleFact<number>;
  fuel?: VehicleFact<string>;
  siiCode?: VehicleFact<string>;
  fiscalValueClp?: VehicleFact<number>;
};

export type ChileVehicleLookupInput = {
  plate?: string;
  siiCode?: string;
  make?: string;
  model?: string;
  version?: string;
  manufactureYear?: number;
};

export interface ChileVehicleDataAdapter {
  readonly adapterId: string;
  readonly source: ChileVehicleDataSource;
  lookup(input: ChileVehicleLookupInput): Promise<ChileVehicleIdentitySnapshot | null>;
}

export const CHILE_VEHICLE_DATA_SOURCES = {
  siiTasacion2026: {
    id: 'sii-tasacion-2026',
    kind: 'official_public_dataset',
    url: 'https://www.sii.cl/servicios_online/1049-2612.html',
    effectiveYear: 2026,
    containsPersonalData: false,
    bulkIngestionCandidate: true,
  },
  registroCivilVehicleRecord: {
    id: 'registro-civil-vehicle-record',
    kind: 'authorized_or_user_initiated_lookup',
    url: 'https://www.chileatiende.gob.cl/fichas/3412-certificado',
    containsPersonalData: true,
    bulkIngestionCandidate: false,
  },
} as const;

export function mergeVehicleIdentitySnapshots(
  snapshots: readonly ChileVehicleIdentitySnapshot[],
): ChileVehicleIdentitySnapshot | null {
  if (snapshots.length === 0) return null;

  const rank: Record<VehicleFactConfidence, number> = {
    declared: 1,
    matched: 2,
    verified: 3,
  };

  function choose<T>(
    values: readonly (VehicleFact<T> | undefined)[],
  ): VehicleFact<T> | undefined {
    return values
      .filter((value): value is VehicleFact<T> => value !== undefined)
      .sort((a, b) => {
        const confidence = rank[b.confidence] - rank[a.confidence];
        if (confidence !== 0) return confidence;
        return Date.parse(b.observedAt) - Date.parse(a.observedAt);
      })[0];
  }

  return {
    plateMasked: snapshots.find((item) => item.plateMasked)?.plateMasked ?? '••••••',
    ...(choose(snapshots.map((item) => item.make)) ? { make: choose(snapshots.map((item) => item.make))! } : {}),
    ...(choose(snapshots.map((item) => item.model)) ? { model: choose(snapshots.map((item) => item.model))! } : {}),
    ...(choose(snapshots.map((item) => item.version)) ? { version: choose(snapshots.map((item) => item.version))! } : {}),
    ...(choose(snapshots.map((item) => item.manufactureYear))
      ? { manufactureYear: choose(snapshots.map((item) => item.manufactureYear))! }
      : {}),
    ...(choose(snapshots.map((item) => item.fuel)) ? { fuel: choose(snapshots.map((item) => item.fuel))! } : {}),
    ...(choose(snapshots.map((item) => item.siiCode)) ? { siiCode: choose(snapshots.map((item) => item.siiCode))! } : {}),
    ...(choose(snapshots.map((item) => item.fiscalValueClp))
      ? { fiscalValueClp: choose(snapshots.map((item) => item.fiscalValueClp))! }
      : {}),
  };
}
