import {
  canProjectAcrossSurfaces,
  processingLaneForAsset,
  validateDataAssetRecord,
  type DataAssetRecord,
} from '../src/data/dataAssetRegistry.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeAsset(overrides: Partial<DataAssetRecord> = {}): DataAssetRecord {
  return {
    assetId: 'ASSET-1',
    name: 'Canonical place data',
    scope: 'palta_product',
    assetClass: 'canonical_public',
    domain: 'local',
    sourceOfTruth: 'canonical-release',
    currentLocation: 'r2/read-model',
    sourceOrigin: 'official-source',
    visibility: 'public',
    dataClass: 'public',
    updateMode: 'data_factory',
    updateFrequency: 'daily',
    versionStrategy: 'release-id+hash',
    countryScope: ['CL'],
    regionScope: ['Santiago'],
    consumers: ['home', 'search'],
    pipelineOwner: 'data-factory',
    runtimeOwner: 'canonical-api',
    migrationDecision: 'CONNECT',
    verificationStatus: 'verified',
    lastCheckedAt: '2026-09-18',
    notes: [],
    ...overrides,
  };
}

const publicCanonical = makeAsset();
assert(validateDataAssetRecord(publicCanonical).length === 0, 'Valid canonical public asset should pass registry validation.');
assert(processingLaneForAsset(publicCanonical) === 'data_factory', 'Canonical public data should use Data Factory lane.');
assert(canProjectAcrossSurfaces(publicCanonical), 'Verified canonical public data may project across Palta surfaces.');

const privatePerson = makeAsset({
  assetId: 'PRIVATE-1',
  assetClass: 'private_person',
  domain: 'home',
  visibility: 'private',
  dataClass: 'sensitive_personal',
  updateMode: 'private_store',
});
assert(validateDataAssetRecord(privatePerson).length === 0, 'Proper private-person asset should pass registry validation.');
assert(processingLaneForAsset(privatePerson) === 'private_store', 'Private person data must use private storage lane.');
assert(!canProjectAcrossSurfaces(privatePerson), 'Private person data must not project as public canonical content.');

const invalidPrivate = makeAsset({
  assetClass: 'private_person',
  visibility: 'public',
  dataClass: 'public',
  updateMode: 'data_factory',
});
const privateErrors = validateDataAssetRecord(invalidPrivate);
assert(privateErrors.some((error) => error.includes('public visibility')), 'Public visibility for private-person data must fail.');
assert(privateErrors.some((error) => error.includes('Data Factory')), 'Data Factory ownership for private-person data must fail.');

const conflicted = makeAsset({ verificationStatus: 'conflict' });
assert(!canProjectAcrossSurfaces(conflicted), 'Conflicted canonical data must not project across surfaces.');

console.log('PASS: Palta Data Master Registry contracts');
