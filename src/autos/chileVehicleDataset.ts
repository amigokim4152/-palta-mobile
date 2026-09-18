import type {
  ChileVehicleDataAdapter,
  ChileVehicleIdentitySnapshot,
  ChileVehicleLookupInput,
  VehicleFact,
} from './chileVehicleData.js';

export type ExternalDatasetFreshness = 'current' | 'stale' | 'superseded' | 'rejected';

export type SiiVehicleTasacionRecord = {
  siiCode: string;
  make: string;
  model: string;
  version?: string;
  manufactureYear: number;
  fiscalValueClp: number;
  vehicleType?: string;
  fuel?: string;
};

export type SiiTasacionSnapshot = {
  snapshotId: string;
  sourceId: 'sii-livianos-2026';
  sourceUrl: string;
  effectiveYear: 2026;
  collectedAt: string;
  sourceObservedAt: string;
  contentSha256: string;
  rowCount: number;
  freshness: ExternalDatasetFreshness;
  records: readonly SiiVehicleTasacionRecord[];
};

export const SII_LIVIANOS_2026_DATASET = {
  id: 'sii-livianos-2026',
  officialLandingUrl: 'https://www.sii.cl/servicios_online/1049-2612.html',
  downloadUrl: 'https://www.sii.cl/servicios_online/tasacion_fiscal_vehiculos/liv2026.xlsx',
  effectiveYear: 2026,
  announcedRecordCount: 81_611,
  minimumExpectedRows: 80_000,
  containsPersonalData: false,
  mobileBundleAllowed: false,
  sourceCanBeCorrectedDuringYear: true,
} as const;

export function normalizeVehicleDatasetText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function validateSiiTasacionSnapshot(
  snapshot: SiiTasacionSnapshot,
  options: { allowPartialForTests?: boolean } = {},
): { valid: boolean; reasons: readonly string[] } {
  const reasons: string[] = [];

  if (snapshot.sourceUrl !== SII_LIVIANOS_2026_DATASET.downloadUrl) reasons.push('unexpected_source_url');
  if (snapshot.effectiveYear !== SII_LIVIANOS_2026_DATASET.effectiveYear) reasons.push('unexpected_effective_year');
  if (snapshot.rowCount !== snapshot.records.length) reasons.push('row_count_mismatch');
  if (!/^[a-f0-9]{64}$/i.test(snapshot.contentSha256)) reasons.push('invalid_sha256');
  if (snapshot.freshness === 'rejected') reasons.push('snapshot_rejected');
  if (!options.allowPartialForTests && snapshot.rowCount < SII_LIVIANOS_2026_DATASET.minimumExpectedRows) {
    reasons.push('unexpectedly_small_dataset');
  }

  return { valid: reasons.length === 0, reasons };
}

type SiiTasacionIndex = {
  byCodeYear: ReadonlyMap<string, SiiVehicleTasacionRecord>;
  byVehicleSignature: ReadonlyMap<string, readonly SiiVehicleTasacionRecord[]>;
};

function codeYearKey(code: string, year: number): string {
  return `${normalizeVehicleDatasetText(code)}|${year}`;
}

function vehicleSignature(input: {
  make: string;
  model: string;
  manufactureYear: number;
  version?: string;
}): string {
  return [
    normalizeVehicleDatasetText(input.make),
    normalizeVehicleDatasetText(input.model),
    input.manufactureYear,
    input.version ? normalizeVehicleDatasetText(input.version) : '',
  ].join('|');
}

export function buildSiiTasacionIndex(records: readonly SiiVehicleTasacionRecord[]): SiiTasacionIndex {
  const byCodeYear = new Map<string, SiiVehicleTasacionRecord>();
  const byVehicleSignature = new Map<string, SiiVehicleTasacionRecord[]>();

  for (const record of records) {
    byCodeYear.set(codeYearKey(record.siiCode, record.manufactureYear), record);

    const fullKey = vehicleSignature(record);
    const fullMatches = byVehicleSignature.get(fullKey) ?? [];
    fullMatches.push(record);
    byVehicleSignature.set(fullKey, fullMatches);

    if (record.version) {
      const broadKey = vehicleSignature({
        make: record.make,
        model: record.model,
        manufactureYear: record.manufactureYear,
      });
      const broadMatches = byVehicleSignature.get(broadKey) ?? [];
      broadMatches.push(record);
      byVehicleSignature.set(broadKey, broadMatches);
    }
  }

  return { byCodeYear, byVehicleSignature };
}

function verifiedFact<T>(
  value: T,
  snapshot: SiiTasacionSnapshot,
): VehicleFact<T> {
  return {
    value,
    source: 'sii_tasacion',
    confidence: 'verified',
    observedAt: snapshot.sourceObservedAt,
    effectiveYear: snapshot.effectiveYear,
    sourceRef: `${snapshot.snapshotId}:${snapshot.contentSha256}`,
  };
}

function snapshotFromRecord(
  record: SiiVehicleTasacionRecord,
  snapshot: SiiTasacionSnapshot,
): ChileVehicleIdentitySnapshot {
  return {
    plateMasked: '••••••',
    make: verifiedFact(record.make, snapshot),
    model: verifiedFact(record.model, snapshot),
    ...(record.version ? { version: verifiedFact(record.version, snapshot) } : {}),
    manufactureYear: verifiedFact(record.manufactureYear, snapshot),
    ...(record.fuel ? { fuel: verifiedFact(record.fuel, snapshot) } : {}),
    siiCode: verifiedFact(record.siiCode, snapshot),
    fiscalValueClp: verifiedFact(record.fiscalValueClp, snapshot),
  };
}

export function createSiiTasacionSnapshotAdapter(
  snapshot: SiiTasacionSnapshot,
): ChileVehicleDataAdapter {
  const validation = validateSiiTasacionSnapshot(snapshot, { allowPartialForTests: snapshot.rowCount < SII_LIVIANOS_2026_DATASET.minimumExpectedRows });
  if (!validation.valid) {
    throw new Error(`Invalid SII tasacion snapshot: ${validation.reasons.join(',')}`);
  }

  const index = buildSiiTasacionIndex(snapshot.records);

  return {
    adapterId: snapshot.snapshotId,
    source: 'sii_tasacion',
    async lookup(input: ChileVehicleLookupInput) {
      let record: SiiVehicleTasacionRecord | undefined;

      if (input.siiCode && input.manufactureYear !== undefined) {
        record = index.byCodeYear.get(codeYearKey(input.siiCode, input.manufactureYear));
      }

      if (!record && input.make && input.model && input.manufactureYear !== undefined) {
        const matches = index.byVehicleSignature.get(
          vehicleSignature({
            make: input.make,
            model: input.model,
            manufactureYear: input.manufactureYear,
            ...(input.version ? { version: input.version } : {}),
          }),
        ) ?? [];

        // Never guess when the public dataset maps the user's description to more than one version.
        if (matches.length === 1) record = matches[0];
      }

      return record ? snapshotFromRecord(record, snapshot) : null;
    },
  };
}
