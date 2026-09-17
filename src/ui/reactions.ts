export type ReactionKey =
  | "appreciate"
  | "helpful"
  | "celebrate"
  | "curious"
  | "concerned"
  | "welcome";

export interface ReactionDefinition {
  readonly key: ReactionKey;
  readonly meaning: string;
  readonly defaultLabelEsCl: string;
  readonly defaultLabelKo: string;
  readonly assetStatus: "semantic_ready_asset_pending" | "asset_ready" | "frozen";
  readonly usableAsCoreNavigationIcon: false;
}

export const PALTA_REACTIONS: Readonly<Record<ReactionKey, ReactionDefinition>> = {
  appreciate: {
    key: "appreciate",
    meaning: "general appreciation without implying agreement",
    defaultLabelEsCl: "Me gusta",
    defaultLabelKo: "좋아요",
    assetStatus: "semantic_ready_asset_pending",
    usableAsCoreNavigationIcon: false,
  },
  helpful: {
    key: "helpful",
    meaning: "the content was useful or practically helpful",
    defaultLabelEsCl: "Útil",
    defaultLabelKo: "도움돼요",
    assetStatus: "semantic_ready_asset_pending",
    usableAsCoreNavigationIcon: false,
  },
  celebrate: {
    key: "celebrate",
    meaning: "positive celebration or congratulations",
    defaultLabelEsCl: "Celebro",
    defaultLabelKo: "축하해요",
    assetStatus: "semantic_ready_asset_pending",
    usableAsCoreNavigationIcon: false,
  },
  curious: {
    key: "curious",
    meaning: "interest, curiosity, or desire to know more",
    defaultLabelEsCl: "Me interesa",
    defaultLabelKo: "궁금해요",
    assetStatus: "semantic_ready_asset_pending",
    usableAsCoreNavigationIcon: false,
  },
  concerned: {
    key: "concerned",
    meaning: "concern without escalating to emergency status",
    defaultLabelEsCl: "Me preocupa",
    defaultLabelKo: "걱정돼요",
    assetStatus: "semantic_ready_asset_pending",
    usableAsCoreNavigationIcon: false,
  },
  welcome: {
    key: "welcome",
    meaning: "friendly welcome for a person or community arrival",
    defaultLabelEsCl: "Bienvenido",
    defaultLabelKo: "환영해요",
    assetStatus: "semantic_ready_asset_pending",
    usableAsCoreNavigationIcon: false,
  },
};

export function isReactionKey(value: string): value is ReactionKey {
  return Object.prototype.hasOwnProperty.call(PALTA_REACTIONS, value);
}
