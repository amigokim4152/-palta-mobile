export type DiscoverySourceType =
  | 'municipal_agenda'
  | 'public_culture'
  | 'venue_official'
  | 'organizer_official'
  | 'ticketing_catalog'
  | 'social_official'
  | 'structured_feed'
  | 'api'
  | 'editorial_directory';

export type CollectorMethod =
  | 'api'
  | 'feed'
  | 'structured_web'
  | 'web_extract'
  | 'document'
  | 'manual_verified';

export type SourceOfficialLevel =
  | 'primary_official'
  | 'official_partner'
  | 'authoritative_public'
  | 'secondary'
  | 'discovery_only';

export type DiscoveryDataSource = Readonly<{
  sourceId: string;
  owner: string;
  sourceType: DiscoverySourceType;
  coverageAreaIds: readonly string[];
  officialLevel: SourceOfficialLevel;
  url?: string;
  feedUrl?: string;
  apiRef?: string;
  collectorMethod: CollectorMethod;
  refreshIntervalMinutes: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  reliability: 'high' | 'medium' | 'low' | 'unknown';
  usageNote?: string;
  active: boolean;
}>;

export type DiscoveryCollectionStage =
  | 'source'
  | 'collect'
  | 'normalize'
  | 'match'
  | 'verify'
  | 'publish'
  | 'expire';

export type DiscoverySourceRun = Readonly<{
  sourceId: string;
  startedAt: string;
  finishedAt?: string;
  stage: DiscoveryCollectionStage;
  status: 'running' | 'success' | 'partial' | 'failed';
  recordsSeen?: number;
  recordsPublished?: number;
  errorCode?: string;
}>;

export function validateDiscoveryDataSource(source: DiscoveryDataSource): readonly string[] {
  const issues: string[] = [];
  if (!source.sourceId.trim()) issues.push('source_id_required');
  if (!source.owner.trim()) issues.push('source_owner_required');
  if (!Number.isFinite(source.refreshIntervalMinutes) || source.refreshIntervalMinutes <= 0) {
    issues.push('refresh_interval_invalid');
  }
  if (!source.url && !source.feedUrl && !source.apiRef && source.collectorMethod !== 'manual_verified') {
    issues.push('source_locator_required');
  }
  if (source.url && !/^https?:\/\//i.test(source.url)) issues.push('source_url_invalid');
  if (source.feedUrl && !/^https?:\/\//i.test(source.feedUrl)) issues.push('feed_url_invalid');
  return [...new Set(issues)];
}

/**
 * This registry represents content/data authorities. It intentionally does not
 * reuse persistence/providerRegistry, which is reserved for replaceable runtime
 * infrastructure providers such as database, maps and storage.
 */
export class DiscoveryDataSourceRegistry {
  private readonly sources = new Map<string, DiscoveryDataSource>();

  register(source: DiscoveryDataSource): void {
    const issues = validateDiscoveryDataSource(source);
    if (issues.length) throw new Error(`invalid_discovery_source:${issues.join(',')}`);
    this.sources.set(source.sourceId, source);
  }

  get(sourceId: string): DiscoveryDataSource | null {
    return this.sources.get(sourceId) ?? null;
  }

  active(): DiscoveryDataSource[] {
    return [...this.sources.values()].filter((source) => source.active);
  }

  byCoverage(areaId: string): DiscoveryDataSource[] {
    return this.active().filter((source) =>
      source.coverageAreaIds.includes(areaId) || source.coverageAreaIds.includes('*'),
    );
  }
}
