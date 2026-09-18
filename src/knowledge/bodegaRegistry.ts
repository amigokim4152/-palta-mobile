import type { KnowledgeDomain, KnowledgeDomainProfile } from './contracts.js';

const updatedAt = '2026-09-18T22:00:00-03:00';

export const BODEGA_DOMAIN_REGISTRY: KnowledgeDomainProfile[] = [
  { domain: 'health', maturity: 'standalone', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], publicSurface: 'palta-health', updatedAt },
  { domain: 'pets', maturity: 'standalone', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], publicSurface: 'palta-pets', updatedAt },
  { domain: 'food', maturity: 'growing', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'education', maturity: 'growing', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'music', maturity: 'seed', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'art', maturity: 'seed', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'finance', maturity: 'seed', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'culture', maturity: 'seed', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'clothing', maturity: 'seed', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
  { domain: 'hobby', maturity: 'seed', canonicalEntityCount: 0, deepGuideCount: 0, relationCount: 0, supportedLocales: ['es-CL'], updatedAt },
];

export function bodegaProfile(domain: KnowledgeDomain): KnowledgeDomainProfile | undefined {
  return BODEGA_DOMAIN_REGISTRY.find((profile) => profile.domain === domain);
}

export function knowledgeEntrySurface(domain: KnowledgeDomain): string {
  const profile = bodegaProfile(domain);
  if (profile?.maturity === 'standalone' && profile.publicSurface) return profile.publicSurface;
  return `palta-bodega/${domain}`;
}
