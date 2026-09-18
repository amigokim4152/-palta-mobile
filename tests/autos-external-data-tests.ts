import {
  candidatesFromDealerDirectorySnapshot,
  reconcileDealerSeedCandidate,
  type AutosDealerDirectorySnapshot,
} from '../src/autos/autosDealerSeedIngestion.js';
import {
  createSiiTasacionSnapshotAdapter,
  validateSiiTasacionSnapshot,
  type SiiTasacionSnapshot,
} from '../src/autos/chileVehicleDataset.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siiSnapshot: SiiTasacionSnapshot = {
  snapshotId: 'sii-livianos-2026-test',
  sourceId: 'sii-livianos-2026',
  sourceUrl: 'https://www.sii.cl/servicios_online/tasacion_fiscal_vehiculos/liv2026.xlsx',
  effectiveYear: 2026,
  collectedAt: '2026-09-18T12:00:00.000Z',
  sourceObservedAt: '2026-09-18T12:00:00.000Z',
  contentSha256: 'a'.repeat(64),
  rowCount: 3,
  freshness: 'current',
  records: [
    {
      siiCode: 'TOY-RAV4-XLE',
      make: 'Toyota',
      model: 'RAV4',
      version: 'XLE',
      manufactureYear: 2021,
      fiscalValueClp: 15_000_000,
      fuel: 'Gasolina',
    },
    {
      siiCode: 'TOY-RAV4-LTD',
      make: 'Toyota',
      model: 'RAV4',
      version: 'Limited',
      manufactureYear: 2021,
      fiscalValueClp: 16_500_000,
      fuel: 'Gasolina',
    },
    {
      siiCode: 'KIA-NIRO-HYB',
      make: 'Kia',
      model: 'Niro',
      version: 'Hybrid',
      manufactureYear: 2022,
      fiscalValueClp: 17_200_000,
      fuel: 'Híbrido',
    },
  ],
};

const snapshotValidation = validateSiiTasacionSnapshot(siiSnapshot, { allowPartialForTests: true });
assert(snapshotValidation.valid, 'A structurally valid partial SII snapshot should pass test validation.');

const siiAdapter = createSiiTasacionSnapshotAdapter(siiSnapshot, { allowPartialForTests: true });
const byCode = await siiAdapter.lookup({ siiCode: 'toy-rav4-xle', manufactureYear: 2021 });
assert(byCode?.fiscalValueClp?.value === 15_000_000, 'SII code + year should resolve an exact fiscal value.');
assert(byCode?.fiscalValueClp?.source === 'sii_tasacion', 'Fiscal value should preserve official-source provenance.');

const byExactVersion = await siiAdapter.lookup({
  make: 'Toyota',
  model: 'RAV4',
  version: 'XLE',
  manufactureYear: 2021,
});
assert(byExactVersion?.siiCode?.value === 'TOY-RAV4-XLE', 'Exact make/model/version/year should resolve when unique.');

const ambiguous = await siiAdapter.lookup({
  make: 'Toyota',
  model: 'RAV4',
  manufactureYear: 2021,
});
assert(ambiguous === null, 'Palta must not guess a fiscal value when multiple SII versions match.');

const missing = await siiAdapter.lookup({
  make: 'Toyota',
  model: 'Unknown',
  manufactureYear: 2021,
});
assert(missing === null, 'Unknown vehicles should remain unresolved instead of receiving an invented value.');

const dealerSnapshot: AutosDealerDirectorySnapshot = {
  snapshotId: 'cavem-centro-test',
  source: 'cavem_public_directory',
  sourceUrl: 'https://www.cavem.cl/socios_centro',
  collectedAt: '2026-09-18T12:00:00.000Z',
  contentSha256: 'b'.repeat(64),
  status: 'current',
  records: [
    {
      sourceRecordId: 'agusavi',
      displayName: 'AGUSAVI',
      website: 'www.agusavi.cl',
      comuna: 'VITACURA',
    },
    {
      sourceRecordId: 'agusavi-duplicate',
      displayName: 'AGUSAVI',
      website: 'https://agusavi.cl/',
      comuna: 'VITACURA',
    },
    {
      sourceRecordId: 'bilbao',
      displayName: 'AUTOMOTORA BILBAO S.A.',
      website: 'www.automotorabilbao.cl',
      comuna: 'PROVIDENCIA',
    },
  ],
};

const candidates = candidatesFromDealerDirectorySnapshot(dealerSnapshot);
assert(candidates.length === 2, 'Directory ingestion should dedupe equivalent public dealer rows.');

const agusavi = candidates.find((candidate) => candidate.displayName === 'AGUSAVI');
assert(agusavi?.website === 'https://agusavi.cl', 'Dealer websites should normalize before reconciliation.');

const matched = reconcileDealerSeedCandidate(agusavi!, [
  {
    businessId: 'business-agusavi',
    displayName: 'Agusavi SpA',
    website: 'https://www.agusavi.cl',
    comuna: 'Vitacura',
  },
]);
assert(
  matched.status === 'matched_existing_business' && matched.businessId === 'business-agusavi',
  'Exact website host should reconcile a seed to the canonical Business.',
);

const unresolved = reconcileDealerSeedCandidate(candidates.find((candidate) => candidate.displayName.includes('BILBAO'))!, []);
assert(unresolved.status === 'new_business_candidate', 'An unmatched public-directory row must remain a candidate, not a verified dealer.');

console.log('PASS: Autos external data snapshot and dealer seed ingestion');
