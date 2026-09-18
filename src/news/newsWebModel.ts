import {
  assertPublicNewsProjectionSafe,
  type PublicNewsBrief,
  type PublicNewsHome,
  type PublicNewsLocalPage,
  type PublicNewsStory,
  type PublicNewsVoiceContribution,
  type PublicNewsVoicesPage,
} from './publicContracts.js';

export interface NewsHomeViewModel {
  readonly essential: readonly PublicNewsBrief[];
  readonly nearby: readonly PublicNewsBrief[];
  readonly local: readonly PublicNewsBrief[];
  readonly chile: readonly PublicNewsBrief[];
  readonly deepDive: readonly PublicNewsBrief[];
  readonly voices: readonly PublicNewsBrief[];
  readonly isEmpty: boolean;
  readonly publicationGate: 'open' | 'closed';
}

export interface NewsLocalViewModel {
  readonly heading: string;
  readonly placeLabel: string;
  readonly current: readonly PublicNewsBrief[];
  readonly briefs: readonly PublicNewsBrief[];
  readonly mapped: readonly PublicNewsBrief[];
  readonly trackedTopics: PublicNewsLocalPage['trackedTopics'];
  readonly crossModuleLinks: PublicNewsLocalPage['crossModuleLinks'];
  readonly voices: readonly PublicNewsVoiceContribution[];
}

export interface NewsStoryViewModel {
  readonly story: PublicNewsStory;
  readonly hasMap: boolean;
  readonly hasWhyItMatters: boolean;
  readonly hasKnownUnknown: boolean;
  readonly sourceLink?: string;
  readonly isExternalSummary: boolean;
}

export interface NewsVoicesViewModel {
  readonly disclosure: string;
  readonly interviews: readonly PublicNewsVoiceContribution[];
  readonly essays: readonly PublicNewsVoiceContribution[];
  readonly showcase: readonly PublicNewsVoiceContribution[];
  readonly fieldNotes: readonly PublicNewsVoiceContribution[];
  readonly memories: readonly PublicNewsVoiceContribution[];
  readonly proposals: readonly PublicNewsVoiceContribution[];
}

const byNewest = <T extends { readonly publishedAt: string }>(rows: readonly T[]): readonly T[] =>
  [...rows].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

export function toNewsHomeViewModel(payload: PublicNewsHome): NewsHomeViewModel {
  assertPublicNewsProjectionSafe(payload);
  const essential = byNewest(payload.sections.essential).slice(0, 3);
  const nearby = byNewest(payload.sections.nearby).slice(0, 12);
  const local = byNewest(payload.sections.local).slice(0, 12);
  const chile = byNewest(payload.sections.chile).slice(0, 8);
  const deepDive = byNewest(payload.sections.deep_dive).slice(0, 4);
  const voices = byNewest(payload.sections.voices).slice(0, 4);
  return {
    essential,
    nearby,
    local,
    chile,
    deepDive,
    voices,
    isEmpty: [essential, nearby, local, chile, deepDive, voices].every((rows) => rows.length === 0),
    publicationGate: payload.publicationGate,
  };
}

export function toNewsLocalViewModel(payload: PublicNewsLocalPage): NewsLocalViewModel {
  assertPublicNewsProjectionSafe(payload);
  return {
    heading: payload.heading,
    placeLabel:
      payload.geography.localityName ??
      payload.geography.comunaName ??
      payload.geography.regionName ??
      'Chile',
    current: byNewest(payload.current).slice(0, 12),
    briefs: byNewest(payload.briefs).slice(0, 30),
    mapped: byNewest([...payload.current, ...payload.briefs]).filter((item) => item.mapContext?.status === 'verified'),
    trackedTopics: payload.trackedTopics,
    crossModuleLinks: payload.crossModuleLinks,
    voices: byNewest(payload.voices).slice(0, 6),
  };
}

export function toNewsStoryViewModel(story: PublicNewsStory): NewsStoryViewModel {
  assertPublicNewsProjectionSafe(story);
  return {
    story,
    hasMap: story.mapContext?.status === 'verified',
    hasWhyItMatters: Boolean(story.whyItMatters?.trim()),
    hasKnownUnknown: Boolean(story.knownUnknown?.known.length || story.knownUnknown?.unknown.length),
    sourceLink: story.source.url,
    isExternalSummary: story.contentClass === 'external_summary',
  };
}

export function toNewsVoicesViewModel(payload: PublicNewsVoicesPage): NewsVoicesViewModel {
  assertPublicNewsProjectionSafe(payload);
  const groups = (type: PublicNewsVoiceContribution['voiceType']) =>
    byNewest(payload.contributions.filter((item) => item.voiceType === type));
  return {
    disclosure: payload.disclosure,
    interviews: groups('interview'),
    essays: groups('essay'),
    showcase: byNewest(payload.contributions.filter((item) => item.voiceType === 'student_art' || item.voiceType === 'photo_essay')),
    fieldNotes: groups('field_note'),
    memories: groups('local_memory'),
    proposals: groups('proposal'),
  };
}
