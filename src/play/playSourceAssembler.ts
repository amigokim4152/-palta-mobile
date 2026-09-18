import {
  projectBusinessExposuresToPlay,
  type ResolvedBusinessPlayExposure,
} from './businessPlayProjection.js';
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
    accepted: number;
    rejected: number;
  }>;
}>;

export function assemblePlaySources(input: PlaySourceAssemblyInput): PlaySourceAssembly {
  const municipal = projectMunicipalEventsToPlay(input.municipalEvents ?? [], input.calendar);
  const business = projectBusinessExposuresToPlay(input.businessExposures ?? []);
  const publicPrograms = (input.publicPrograms ?? []).filter(
    (item) => item.sourceKind === 'public_program' || item.sourceKind === 'place',
  );

  const candidates = [...municipal, ...publicPrograms, ...business];
  const items: PlayDiscoveryItem[] = [];
  const rejected: Array<{ itemId: string; issues: readonly string[] }> = [];

  for (const item of candidates) {
    const issues = validatePlayDiscoveryItem(item);
    if (issues.length) {
      rejected.push({ itemId: item.id || 'unknown', issues });
      continue;
    }
    items.push(item);
  }

  return {
    items,
    rejected,
    counts: {
      municipal: municipal.length,
      publicProgram: publicPrograms.length,
      business: business.length,
      accepted: items.length,
      rejected: rejected.length,
    },
  };
}
