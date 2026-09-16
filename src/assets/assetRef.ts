export type AssetKind =
  | 'brand'
  | 'business_media'
  | 'document'
  | 'map_release'
  | 'content_media'
  | 'temporary_upload';

export type AssetRef = {
  assetId: string;
  kind: AssetKind;
  logicalKey: string;
  contentType?: string;
  sha256?: string;
  bytes?: number;
  version?: string;
};

export function isProviderNeutralAssetRef(
  ref: AssetRef,
): boolean {
  const value = `${ref.assetId} ${ref.logicalKey}`;
  return !/(r2|s3|supabase|cloudinary|workers|amazonaws|cloudflare)/i.test(value);
}
