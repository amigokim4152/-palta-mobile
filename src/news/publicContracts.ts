export type PublicNewsContentClass =
  | "external_summary"
  | "official_source"
  | "palta_original"
  | "deep_dive"
  | "local_voice";

export type PublicNewsSection =
  | "essential"
  | "nearby"
  | "chile"
  | "local"
  | "deep_dive"
  | "voices";

export type PublicNewsActionKind =
  | "map"
  | "follow_place"
  | "alerts"
  | "save"
  | "event"
  | "benefit"
  | "procedure"
  | "transport"
  | "community";

export interface PublicNewsGeography {
  readonly countryCode: "CL";
  readonly regionCode?: string;
  readonly regionName?: string;
  readonly comunaCode?: string;
  readonly comunaName?: string;
  readonly localityName?: string;
  readonly precision: "country" | "region" | "comuna" | "locality" | "place";
}

export interface PublicNewsSource {
  readonly label: string;
  readonly url?: string;
  readonly attribution: string;
  readonly sourceType: "official" | "media" | "local_media" | "radio" | "community" | "contributor" | "palta";
}

export interface PublicNewsMapContext {
  readonly status: "verified";
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly zoomHint?: number;
}

export interface PublicNewsAction {
  readonly kind: PublicNewsActionKind;
  readonly label: string;
  readonly target: string;
}

export interface PublicNewsBrief {
  readonly storyId: string;
  readonly slug: string;
  readonly section: PublicNewsSection;
  readonly title: string;
  readonly summary: string;
  readonly contentClass: PublicNewsContentClass;
  readonly publishedAt: string;
  readonly updatedAt?: string;
  readonly geography: PublicNewsGeography;
  readonly topic: string;
  readonly source: PublicNewsSource;
  readonly mapContext?: PublicNewsMapContext;
  readonly actions: readonly PublicNewsAction[];
  readonly correctionState?: "none" | "updated" | "corrected";
  readonly updatedNotice?: string;
}

export type PublicNewsVoiceType =
  | "essay"
  | "interview"
  | "field_note"
  | "photo_essay"
  | "student_art"
  | "local_memory"
  | "proposal";

export interface PublicNewsStory extends PublicNewsBrief {
  readonly standfirst?: string;
  readonly body?: readonly string[];
  readonly whyItMatters?: string;
  readonly knownUnknown?: {
    readonly known: readonly string[];
    readonly unknown: readonly string[];
  };
  readonly timeline?: readonly {
    readonly at: string;
    readonly label: string;
  }[];
  // Present only when contentClass === "local_voice". The Local Voices list contract
  // requires these fields; story detail keeps them so attribution/rights remain visible.
  readonly voiceType?: PublicNewsVoiceType;
  readonly contributorLabel?: string;
  readonly perspectiveDisclosure?: string;
  readonly mediaRights?: "none_required" | "cleared";
}

export interface PublicNewsHome {
  readonly schemaVersion: 1;
  readonly locale: "es-CL";
  readonly generatedAt: string;
  readonly publicationGate: "open" | "closed";
  readonly sections: Readonly<Record<PublicNewsSection, readonly PublicNewsBrief[]>>;
}

export interface PublicNewsModuleLink {
  readonly module: "events" | "benefits" | "procedures" | "transport" | "community" | "map";
  readonly label: string;
  readonly target: string;
  readonly reason: string;
}

export interface PublicNewsTrackedTopic {
  readonly topicId: string;
  readonly label: string;
  readonly status: "watching" | "developing" | "stable";
  readonly evidenceCount: number;
  readonly deepDiveSlug?: string;
}

export interface PublicNewsLocalPage {
  readonly schemaVersion: 1;
  readonly locale: "es-CL";
  readonly generatedAt: string;
  readonly publicationGate: "open" | "closed";
  readonly geography: PublicNewsGeography;
  readonly heading: string;
  readonly current: readonly PublicNewsBrief[];
  readonly briefs: readonly PublicNewsBrief[];
  readonly trackedTopics: readonly PublicNewsTrackedTopic[];
  readonly crossModuleLinks: readonly PublicNewsModuleLink[];
  readonly voices: readonly PublicNewsVoiceContribution[];
}

export interface PublicNewsVoiceContribution extends PublicNewsBrief {
  readonly section: "voices";
  readonly contentClass: "local_voice";
  readonly voiceType: PublicNewsVoiceType;
  readonly contributorLabel: string;
  readonly perspectiveDisclosure: string;
  readonly mediaRights: "none_required" | "cleared";
}

export interface PublicNewsVoicesPage {
  readonly schemaVersion: 1;
  readonly locale: "es-CL";
  readonly generatedAt: string;
  readonly publicationGate: "open" | "closed";
  readonly disclosure: string;
  readonly contributions: readonly PublicNewsVoiceContribution[];
}

export const forbiddenPublicNewsFields = [
  "risk_flags",
  "editorial_state",
  "reviewer_notes",
  "ai_notes",
  "ai_processed",
  "raw_title",
  "source_excerpt",
  "fact_object",
  "verification_queue",
] as const;

export function assertPublicNewsProjectionSafe(value: unknown): void {
  const stack: unknown[] = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if ((forbiddenPublicNewsFields as readonly string[]).includes(key)) {
        throw new Error(`Internal News field cannot enter public projection: ${key}`);
      }
      stack.push(child);
    }
  }
}
