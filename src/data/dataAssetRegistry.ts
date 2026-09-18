export type DataAssetClass =
  | 'source_raw_research'
  | 'canonical_public'
  | 'knowledge_content'
  | 'news_editorial'
  | 'runtime_event'
  | 'product_transaction'
  | 'private_person'
  | 'static_asset';

export type MigrationDecision =
  | 'KEEP'
  | 'CONNECT'
  | 'UPGRADE'
  | 'REBUILD'
  | 'ARCHIVE'
  | 'AUDIT_REQUIRED';

export type RegistryVerificationStatus =
  | 'verified'
  | 'corroborated'
  | 'needs_verification'
  | 'stale'
  | 'conflict'
  | 'rejected';

export type RegistryVisibility = 'public' | 'internal' | 'private' | 'mixed';

export type UpdateMode =
  | 'manual'
  | 'data_factory'
  | 'runtime_event'
  | 'knowledge_ops'
  | 'product_core'
  | 'private_store'
  | 'immutable_release';

export type DataAssetRecord = {
  assetId: string;
  name: string;
  scope: string;
  assetClass: DataAssetClass;
  domain: string;
  sourceOfTruth: string;
  currentLocation: string;
  sourceOrigin: string;
  visibility: RegistryVisibility;
  dataClass: string;
  updateMode: UpdateMode;
  updateFrequency: string;
  versionStrategy: string;
  countryScope: string[];
  regionScope: string[];
  consumers: string[];
  pipelineOwner: string;
  runtimeOwner: string;
  migrationDecision: MigrationDecision;
  verificationStatus: RegistryVerificationStatus;
  lastCheckedAt: string;
  notes: string[];
};

export type ProcessingLane =
  | 'source_archive'
  | 'data_factory'
  | 'knowledge_ops'
  | 'news_editorial'
  | 'runtime_event_core'
  | 'product_core'
  | 'private_store'
  | 'asset_pipeline';

export function processingLaneForAsset(asset: Pick<DataAssetRecord, 'assetClass' | 'updateMode'>): ProcessingLane {
  if (asset.updateMode === 'runtime_event' || asset.assetClass === 'runtime_event') return 'runtime_event_core';
  if (asset.assetClass === 'private_person' || asset.updateMode === 'private_store') return 'private_store';
  if (asset.assetClass === 'product_transaction' || asset.updateMode === 'product_core') return 'product_core';
  if (asset.assetClass === 'knowledge_content' || asset.updateMode === 'knowledge_ops') return 'knowledge_ops';
  if (asset.assetClass === 'news_editorial') return 'news_editorial';
  if (asset.assetClass === 'canonical_public' || asset.updateMode === 'data_factory') return 'data_factory';
  if (asset.assetClass === 'static_asset') return 'asset_pipeline';
  return 'source_archive';
}

export function validateDataAssetRecord(asset: DataAssetRecord): string[] {
  const errors: string[] = [];

  if (!asset.assetId.trim()) errors.push('assetId is required');
  if (!asset.name.trim()) errors.push('name is required');
  if (!asset.scope.trim()) errors.push('scope is required');
  if (!asset.sourceOfTruth.trim()) errors.push('sourceOfTruth is required');
  if (!asset.currentLocation.trim()) errors.push('currentLocation is required');
  if (!asset.lastCheckedAt.trim()) errors.push('lastCheckedAt is required');

  if (asset.assetClass === 'canonical_public' && asset.visibility === 'private') {
    errors.push('canonical_public asset cannot have private visibility');
  }

  if (asset.assetClass === 'private_person' && asset.visibility === 'public') {
    errors.push('private_person asset cannot have public visibility');
  }

  if (asset.assetClass === 'private_person' && asset.updateMode === 'data_factory') {
    errors.push('private_person asset cannot be owned by the public Data Factory lane');
  }

  if (asset.assetClass === 'runtime_event' && asset.updateMode === 'immutable_release') {
    errors.push('runtime_event asset cannot use immutable_release as its update mode');
  }

  if (asset.scope === 'palta_product' && asset.assetClass === 'private_person' && asset.dataClass === 'public') {
    errors.push('private_person asset cannot use public dataClass');
  }

  return errors;
}

export function canProjectAcrossSurfaces(asset: DataAssetRecord): boolean {
  return (
    (asset.assetClass === 'canonical_public' || asset.assetClass === 'knowledge_content') &&
    asset.visibility !== 'private' &&
    asset.migrationDecision !== 'REBUILD' &&
    asset.migrationDecision !== 'ARCHIVE' &&
    asset.verificationStatus !== 'rejected' &&
    asset.verificationStatus !== 'conflict'
  );
}
