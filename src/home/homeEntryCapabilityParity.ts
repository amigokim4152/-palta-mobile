export type HomeEntryCapabilityDefinition = {
  key: string;
  ownerDomain: string;
  legacyRoute: string;
  demoRequired: true;
  description: string;
};

/**
 * Navigation/entry capabilities recovered from the legacy Base44 Home.
 *
 * These are intentionally separate from life cards. A domain can have both a
 * concise contextual Home card and a stable entry point into the full domain.
 * Visual placement may change later; the capability must not disappear during
 * the independent-app migration.
 */
export const HOME_ENTRY_CAPABILITIES: readonly HomeEntryCapabilityDefinition[] = [
  { key: 'entry.search', ownerDomain: 'Search', legacyRoute: '/search', demoRequired: true, description: 'Search across Palta domains and local context.' },
  { key: 'entry.nearby', ownerDomain: 'Geo/Local Discovery', legacyRoute: '/nearby', demoRequired: true, description: 'Find useful places and activity around the effective locality.' },
  { key: 'entry.local_business', ownerDomain: 'Local Business', legacyRoute: '/businesses', demoRequired: true, description: 'Open nearby/local businesses.' },
  { key: 'entry.real_estate', ownerDomain: 'Real Estate', legacyRoute: '/market/property', demoRequired: true, description: 'Open housing/property discovery.' },
  { key: 'entry.community', ownerDomain: 'Community', legacyRoute: '/community', demoRequired: true, description: 'Open joined/local community.' },
  { key: 'entry.map', ownerDomain: 'Map/Geo', legacyRoute: '/map', demoRequired: true, description: 'Open shared Palta map/nearby context.' },
  { key: 'entry.health', ownerDomain: 'Health', legacyRoute: '/salud', demoRequired: true, description: 'Open health domain.' },
  { key: 'entry.pets', ownerDomain: 'Pets', legacyRoute: '/pets', demoRequired: true, description: 'Open pet domain.' },
  { key: 'entry.education', ownerDomain: 'Education/School', legacyRoute: '/schools', demoRequired: true, description: 'Open education/school domain.' },
  { key: 'entry.marketplace', ownerDomain: 'Marketplace', legacyRoute: '/market', demoRequired: true, description: 'Open local marketplace.' },
  { key: 'entry.jobs', ownerDomain: 'Jobs', legacyRoute: '/jobs', demoRequired: true, description: 'Open jobs and short gigs.' },
  { key: 'entry.food', ownerDomain: 'Food', legacyRoute: '/food', demoRequired: true, description: 'Open food, seasonal produce and food-business domain.' },
  { key: 'entry.events', ownerDomain: 'Events/Play', legacyRoute: '/events', demoRequired: true, description: 'Open events and activities.' },
  { key: 'entry.exchange', ownerDomain: 'Economy', legacyRoute: '/exchange', demoRequired: true, description: 'Open exchange/UF details.' },
  { key: 'entry.interests', ownerDomain: 'Personalization', legacyRoute: '/interests', demoRequired: true, description: 'Review and edit explicit interests that drive Home personalization.' },
  { key: 'entry.kids', ownerDomain: 'Kids', legacyRoute: '/kids', demoRequired: true, description: 'Open curated child/family content surface.' },
  { key: 'entry.services', ownerDomain: 'Services/Care', legacyRoute: '/services', demoRequired: true, description: 'Open service-request/Chile work-assistance surface.' },
  { key: 'entry.more', ownerDomain: 'Shell', legacyRoute: '/more', demoRequired: true, description: 'Open complete Palta navigation/discovery hub.' },
] as const;

export function requiredHomeEntryCapabilityKeys(): string[] {
  return HOME_ENTRY_CAPABILITIES.map((entry) => entry.key);
}
