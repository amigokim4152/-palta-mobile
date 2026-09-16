export type ReleaseFile = {
  logicalKey: string;
  sha256: string;
  bytes: number;
  contentType?: string;
};

export type DataReleaseManifest = {
  releaseId: string;
  dataset: string;
  country: string;
  createdAt: string;
  schemaVersion: string;
  files: ReleaseFile[];
  previousReleaseId?: string;
};

export function validateReleaseManifest(
  manifest: DataReleaseManifest,
): string[] {
  const errors: string[] = [];

  if (!manifest.releaseId.trim()) errors.push('release_id_required');
  if (!manifest.dataset.trim()) errors.push('dataset_required');
  if (!manifest.country.trim()) errors.push('country_required');
  if (!manifest.schemaVersion.trim()) errors.push('schema_version_required');
  if (manifest.files.length === 0) errors.push('release_files_required');

  const seen = new Set<string>();
  for (const file of manifest.files) {
    if (!file.logicalKey.trim()) errors.push('file_logical_key_required');
    if (!/^[a-f0-9]{64}$/i.test(file.sha256)) errors.push('file_sha256_invalid');
    if (!Number.isInteger(file.bytes) || file.bytes < 0) {
      errors.push('file_bytes_invalid');
    }
    if (seen.has(file.logicalKey)) errors.push('duplicate_logical_key');
    seen.add(file.logicalKey);
  }

  return errors;
}
