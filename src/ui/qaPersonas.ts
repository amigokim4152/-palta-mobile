import type { CharacterId } from "./characters.js";

export interface DesignQaPersona {
  readonly id: string;
  readonly characterVariant: CharacterId | "ADULT_VARIANT_TBD" | "FAMILY_VARIANT";
  readonly comuna: string;
  readonly lifeRole: string;
  readonly primaryDomains: readonly string[];
  readonly expectedChecks: readonly string[];
  readonly status: "active_baseline";
}

export const DESIGN_QA_PERSONAS: readonly DesignQaPersona[] = [
  {
    id: "QA-01",
    characterVariant: "CHAR_PAPA",
    comuna: "Vitacura",
    lifeRole: "parent / business owner",
    primaryDomains: ["Local Business", "School", "Vehicle", "Business"],
    expectedChecks: ["home cards", "locality", "business state", "vehicle state"],
    status: "active_baseline",
  },
  {
    id: "QA-02",
    characterVariant: "CHAR_MAMA",
    comuna: "Providencia",
    lifeRole: "commuter / parent",
    primaryDomains: ["Metro", "Bus", "Culture", "Local Business"],
    expectedChecks: ["transit", "events", "nearby sorting"],
    status: "active_baseline",
  },
  {
    id: "QA-03",
    characterVariant: "CHAR_HIJO",
    comuna: "Macul",
    lifeRole: "student / family member",
    primaryDomains: ["School", "Sports", "Community", "Public Services"],
    expectedChecks: ["school context", "sports", "locality boundary"],
    status: "active_baseline",
  },
  {
    id: "QA-04",
    characterVariant: "ADULT_VARIANT_TBD",
    comuna: "Santiago Centro",
    lifeRole: "single renter",
    primaryDomains: ["Real Estate", "Marketplace", "Admin", "Transport"],
    expectedChecks: ["rental", "marketplace", "procedures"],
    status: "active_baseline",
  },
  {
    id: "QA-05",
    characterVariant: "FAMILY_VARIANT",
    comuna: "La Florida / Puente Alto",
    lifeRole: "family / long commute",
    primaryDomains: ["Commute", "Benefits", "Municipality", "Jobs"],
    expectedChecks: ["distance", "benefits", "municipal routing"],
    status: "active_baseline",
  },
];
