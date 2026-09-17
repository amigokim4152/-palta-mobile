import type { CharacterId } from "./characters.js";

export type LivingExampleScenarioId =
  | "LE-01"
  | "LE-02"
  | "LE-03"
  | "LE-04"
  | "LE-05"
  | "LE-06"
  | "LE-07"
  | "LE-08";

export type LivingExampleDataMode = "synthetic" | "hybrid" | "hybrid_real_fact_character_comment";

export interface LivingExampleScenario {
  readonly id: LivingExampleScenarioId;
  readonly domain:
    | "local_news"
    | "marketplace"
    | "real_estate"
    | "local_business"
    | "business"
    | "transport"
    | "pets"
    | "school_family";
  readonly title: string;
  readonly characterId: CharacterId;
  readonly dataMode: LivingExampleDataMode;
  readonly localityScope: string;
  readonly inAppRole: string;
  readonly fallbackRule: string;
  readonly qaUse: readonly string[];
  readonly status: "ready_to_design";
  readonly syntheticAnalyticsExcluded: true;
  readonly exampleDisclosureRequired: true;
}

export const LIVING_EXAMPLE_SCENARIOS: Readonly<Record<LivingExampleScenarioId, LivingExampleScenario>> = {
  "LE-01": {
    id: "LE-01",
    domain: "local_news",
    title: "오늘 저녁 지역 행사",
    characterId: "CHAR_MAMA",
    dataMode: "hybrid_real_fact_character_comment",
    localityScope: "comuna",
    inAppRole: "생활 코멘트",
    fallbackRule: "always optional",
    qaUse: ["locality feed routing"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-02": {
    id: "LE-02",
    domain: "marketplace",
    title: "중고 생활용품 판매",
    characterId: "CHAR_PAPA",
    dataMode: "synthetic",
    localityScope: "comuna",
    inAppRole: "seed listing",
    fallbackRule: "real_count < 5",
    qaUse: ["create", "search", "detail", "profile"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-03": {
    id: "LE-03",
    domain: "real_estate",
    title: "지역별 주택/임대 예시",
    characterId: "CHAR_PAPA",
    dataMode: "synthetic",
    localityScope: "district/comuna",
    inAppRole: "seed property",
    fallbackRule: "real_count < 5",
    qaUse: ["map", "filter", "detail", "profile"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-04": {
    id: "LE-04",
    domain: "local_business",
    title: "동네 가게 프로필",
    characterId: "CHAR_MAMA",
    dataMode: "synthetic",
    localityScope: "comuna",
    inAppRole: "seed business",
    fallbackRule: "category empty",
    qaUse: ["radius", "sort", "profile"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-05": {
    id: "LE-05",
    domain: "business",
    title: "매출·재고·세무 상태",
    characterId: "CHAR_PAPA",
    dataMode: "synthetic",
    localityScope: "not public",
    inAppRole: "guided sample",
    fallbackRule: "new business account",
    qaUse: ["dashboard", "permissions"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-06": {
    id: "LE-06",
    domain: "transport",
    title: "출근/등교 이동",
    characterId: "CHAR_PAPA",
    dataMode: "hybrid",
    localityScope: "route/locality",
    inAppRole: "usage example",
    fallbackRule: "onboarding/help",
    qaUse: ["location", "realtime routing"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-07": {
    id: "LE-07",
    domain: "pets",
    title: "동물병원·등록·산책",
    characterId: "CHAR_ROCO",
    dataMode: "hybrid",
    localityScope: "comuna",
    inAppRole: "usage example",
    fallbackRule: "no pet data",
    qaUse: ["local services", "profile"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
  "LE-08": {
    id: "LE-08",
    domain: "school_family",
    title: "준비물·일정·방과후 활동",
    characterId: "CHAR_HIJO",
    dataMode: "hybrid",
    localityScope: "school/locality",
    inAppRole: "usage example",
    fallbackRule: "empty family setup",
    qaUse: ["school", "locality personalization"],
    status: "ready_to_design",
    syntheticAnalyticsExcluded: true,
    exampleDisclosureRequired: true,
  },
};

export function getLivingExampleForDomain(domain: LivingExampleScenario["domain"]): LivingExampleScenario[] {
  return Object.values(LIVING_EXAMPLE_SCENARIOS).filter((scenario) => scenario.domain === domain);
}
