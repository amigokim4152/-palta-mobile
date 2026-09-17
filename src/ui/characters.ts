export type CharacterId =
  | "CHAR_PAPA"
  | "CHAR_MAMA"
  | "CHAR_HIJO"
  | "CHAR_HIJA"
  | "CHAR_ROCO"
  | "CHAR_LUNA";

export type CharacterStatus = "provisional" | "approved" | "retired";
export type CharacterAssetStatus =
  | "reference_images_available"
  | "runtime_assets_ready"
  | "final_assets_frozen";

export type CharacterContextRisk =
  | "ordinary"
  | "minor_privacy"
  | "medical_serious"
  | "health_critical"
  | "disaster_emergency"
  | "violence_crime"
  | "death"
  | "legal_tax_high_risk"
  | "debt_enforcement";

export interface PaltaCharacterDefinition {
  readonly id: CharacterId;
  readonly displayName: string;
  readonly archetype: string;
  readonly status: CharacterStatus;
  readonly assetStatus: CharacterAssetStatus;
  readonly inAppUse: boolean;
  readonly socialUse: boolean;
}

export const PALTA_CHARACTERS: Readonly<Record<CharacterId, PaltaCharacterDefinition>> = {
  CHAR_PAPA: {
    id: "CHAR_PAPA",
    displayName: "Palto Papá",
    archetype: "adult / parent / business / vehicle",
    status: "provisional",
    assetStatus: "reference_images_available",
    inAppUse: true,
    socialUse: true,
  },
  CHAR_MAMA: {
    id: "CHAR_MAMA",
    displayName: "Palta Mamá",
    archetype: "adult / parent / family / local life",
    status: "provisional",
    assetStatus: "reference_images_available",
    inAppUse: true,
    socialUse: true,
  },
  CHAR_HIJO: {
    id: "CHAR_HIJO",
    displayName: "Palti Hijo",
    archetype: "child / school / sports / activities",
    status: "provisional",
    assetStatus: "reference_images_available",
    inAppUse: true,
    socialUse: true,
  },
  CHAR_HIJA: {
    id: "CHAR_HIJA",
    displayName: "Paltita Hija",
    archetype: "young child / family / growth / play",
    status: "provisional",
    assetStatus: "reference_images_available",
    inAppUse: true,
    socialUse: true,
  },
  CHAR_ROCO: {
    id: "CHAR_ROCO",
    displayName: "Roco",
    archetype: "dog / pet life / outdoors",
    status: "provisional",
    assetStatus: "reference_images_available",
    inAppUse: true,
    socialUse: true,
  },
  CHAR_LUNA: {
    id: "CHAR_LUNA",
    displayName: "Luna",
    archetype: "cat / pet life / home",
    status: "provisional",
    assetStatus: "reference_images_available",
    inAppUse: true,
    socialUse: true,
  },
};

const CHARACTER_RESTRICTED_CONTEXTS: ReadonlySet<CharacterContextRisk> = new Set([
  "health_critical",
  "disaster_emergency",
  "violence_crime",
  "death",
  "legal_tax_high_risk",
  "debt_enforcement",
]);

export function mayUseCharacterInContext(context: CharacterContextRisk): boolean {
  return !CHARACTER_RESTRICTED_CONTEXTS.has(context);
}

export interface CharacterUsageContract {
  readonly characterId: CharacterId;
  readonly context: CharacterContextRisk;
  readonly purpose: "living_example" | "onboarding" | "local_story" | "empty_state" | "social";
  readonly synthetic: true;
  readonly exampleLabelRequired: true;
  readonly runtimeAssetId?: string;
}

export function createCharacterUsage(
  characterId: CharacterId,
  context: CharacterContextRisk,
  purpose: CharacterUsageContract["purpose"],
  runtimeAssetId?: string,
): CharacterUsageContract | null {
  if (!mayUseCharacterInContext(context)) return null;

  return runtimeAssetId === undefined
    ? { characterId, context, purpose, synthetic: true, exampleLabelRequired: true }
    : { characterId, context, purpose, synthetic: true, exampleLabelRequired: true, runtimeAssetId };
}
