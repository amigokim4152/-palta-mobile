import {
  projectBusinessExposuresToPlay,
  type ResolvedBusinessPlayExposure,
} from './businessPlayProjection.js';
import {
  projectCanonicalCatalogToPlay,
  type CanonicalDiscoveryCatalog,
  type CanonicalPlayProjectionContext,
} from './canonicalDiscoveryProjection.js';
import { canonicalizePlayDiscoveryItems } from './playCanonicalization.js';
import {
  projectMunicipalEventsToPlay,
  type MunicipalEventPlayInput,
  type MunicipalPlayProjectionContext,
} from './municipalEventProjection.js';
import {
  validatePlayDiscoveryItem,
  type PlayDiscoveryItem,
} from './playDiscovery.js';

export type PlaySourceAssemblyInput = Readonly<{
  municipalEvents?: readonly MunicipalEventPlayInput[];
  businessExposures?: readonly ResolvedBusinessPlayExposure[];
  publicPrograms?: readonly PlayDiscoveryItem[];
  /** Canonical cross-surface Venue/Event/Offering catalog. */
  canonicalCatalog?: CanonicalDiscoveryCatalog;
  canonicalContext?: CanonicalPlayProjectionContext;
  /**
   * Already-normalized items from cinema/showtime, ticketing, tourism or other
   * discovery providers. Provider-specific schemas must be adapted upstream.
   */
  catalogItems?: readonly PlayDiscoveryItem[];
  calendar: MunicipalPlayProjectionContext;
}>;

export type PlaySourceAssembly = Readonly<{
  items: readonly PlayDiscoveryItem[];
  rejected: readonly {
    itemId: string;
    issues: readonly string[];
  }[];
  counts: Readonly<{
    municipal: number;
    publicProgram: number;
    business: number;
    canonical: number;
    catalog: number;
    acceptedBeforeDedupe: number;
    accepted: number;
    deduplicated: number;
    rejected: number;
  }>;
}>;

/**
 * One bounded ingestion boundary for Play.
 *
 * Data ownership stays upstream:
 * - municipal/public event facts remain owned by the public-data layer;
 * - canonical Business identity remains owned by Business Core;
 * - Venue/Event/Offering identity lives in the canonical Discovery catalog;
 * - cinema/ticket/tourism providers own their operational source facts;
 * - Play only assembles normalized read projections for discovery.
 */
export function assemblePlaySources(input: PlaySourceAssemblyInput): PlaySourceAssembly {
  const municipal = projectMunicipalEventsToPlay(
    input.municipalEvents ?? [],
    input.calendar,
  );
  const business = projectBusinessExposuresToPlay(input.businessExposures ?? []);
  const publicPrograms = (input.publicPrograms ?? []).filter(
    (item) => item.sourceKind === 'public_program' || item.sourceKind === 'place',
  );
  const catalog = (input.catalogItems ?? []).filter(
    (item) => item.sourceKind === 'partner_feed' || item.sourceKind === 'editorial',
  );
  const canonical = input.canonicalCatalog && input.canonicalContext
    ? projectCanonicalCatalogToPlay(input.canonicalCatalog, input.canonicalContext)
    : [];

  const candidates = [...municipal, ...publicPrograms, ...canonical, ...catalog, ...business];
  const accepted: PlayDiscoveryItem[] = [];
  const rejected: Array<{ itemId: string; issues: readonly string[] }> = [];

  for (const item of candidates) {
    const issues = validatePlayDiscoveryItem(item);
    if (issues.length) {
      rejected.push({ itemId: item.id || 'unknown', issues });
      continue;
    }
    accepted.push(item);
  }

  const items = canonicalizePlayDiscoveryItems(accepted);

  return {
    items,
    rejected,
    counts: {
      municipal: municipal.length,
      publicProgram: publicPrograms.length,
      business: business.length,
      canonical: canonical.length,
      catalog: catalog.length,
      acceptedBeforeDedupe: accepted.length,
      accepted: items.length,
      deduplicated: accepted.length - items.length,
      rejected: rejected.length,
    },
  };
}
