export type ServiceResolverEntry = {
  serviceId: string;
  discoveryGroupKey: string;
  label: string;
  aliases: readonly string[];
  intentPhrases?: readonly string[];
  negativeTerms?: readonly string[];
  archetypeCandidates?: readonly string[];
};

export type ServiceResolverContext = {
  preferredDiscoveryGroupKeys?: readonly string[];
};

export type ServiceResolution = {
  serviceId: string;
  discoveryGroupKey: string;
  label: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: readonly string[];
  archetypeCandidates: readonly string[];
};

export type ServiceResolutionResult = {
  suggestions: readonly ServiceResolution[];
  ambiguous: boolean;
  matchedDiscoveryGroups: readonly string[];
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .replace(/[^a-z0-9ñü\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phrasePresent(query: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  return query === normalizedPhrase || query.includes(normalizedPhrase);
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((token) => token.length >= 2));
}

function overlapScore(query: string, candidate: string): number {
  const queryTokens = tokenSet(query);
  const candidateTokens = tokenSet(candidate);
  if (candidateTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of candidateTokens) {
    if (queryTokens.has(token)) overlap += 1;
  }
  return overlap / candidateTokens.size;
}

function confidenceFor(score: number): 'high' | 'medium' | 'low' {
  if (score >= 90) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function resolveServiceSuggestions(
  ownerWords: string,
  entries: readonly ServiceResolverEntry[],
  context: ServiceResolverContext = {},
): ServiceResolutionResult {
  const query = normalize(ownerWords);
  if (!query) return { suggestions: [], ambiguous: false, matchedDiscoveryGroups: [] };

  const preferredGroups = new Set(context.preferredDiscoveryGroupKeys ?? []);
  const resolutions: ServiceResolution[] = [];

  for (const entry of entries) {
    const negativeHit = (entry.negativeTerms ?? []).some((term) => phrasePresent(query, term));
    if (negativeHit) continue;

    const candidateTerms = [entry.label, ...entry.aliases, ...(entry.intentPhrases ?? [])];
    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of candidateTerms) {
      const normalizedTerm = normalize(term);
      if (!normalizedTerm) continue;
      if (query === normalizedTerm) {
        score = Math.max(score, 120);
        matchedTerms.push(term);
        continue;
      }
      if (phrasePresent(query, term)) {
        score = Math.max(score, 95);
        matchedTerms.push(term);
        continue;
      }
      const overlap = overlapScore(query, term);
      if (overlap >= 1) {
        score = Math.max(score, 70);
        matchedTerms.push(term);
      } else if (overlap >= 0.5) {
        score = Math.max(score, 45);
        matchedTerms.push(term);
      }
    }

    if (score === 0) continue;
    if (preferredGroups.has(entry.discoveryGroupKey)) score += 12;

    resolutions.push({
      serviceId: entry.serviceId,
      discoveryGroupKey: entry.discoveryGroupKey,
      label: entry.label,
      score,
      confidence: confidenceFor(score),
      matchedTerms: [...new Set(matchedTerms)],
      archetypeCandidates: [...(entry.archetypeCandidates ?? [])],
    });
  }

  resolutions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.label.localeCompare(b.label, 'es-CL');
  });

  const suggestions = resolutions.slice(0, 3);
  const strong = suggestions.filter((item) => item.score >= 70);
  const matchedDiscoveryGroups = [...new Set(strong.map((item) => item.discoveryGroupKey))];
  const ambiguous =
    strong.length >= 2 &&
    matchedDiscoveryGroups.length >= 2 &&
    Math.abs(strong[0]!.score - strong[1]!.score) <= 20;

  return { suggestions, ambiguous, matchedDiscoveryGroups };
}
